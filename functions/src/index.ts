import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import {
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import { sendEmail } from "./mailer";
import {
  invitationEmail,
  invoiceEmail,
  paymentReceiptEmail,
  welcomeEmail,
} from "./templates";

admin.initializeApp();
const db = admin.firestore();

// ================================================================
// 1. INVITATION EMAIL — triggered when /invitations/{id} is created
// ================================================================

export const onInvitationCreated = onDocumentCreated(
  "invitations/{invitationId}",
  async (event) => {
    const invitationId = event.params.invitationId;
    logger.info("🎯 [onInvitationCreated] Triggered", { invitationId });

    const data = event.data?.data();
    if (!data) {
      logger.warn("🎯 [onInvitationCreated] No data in event — skipping");
      return;
    }

    logger.info("🎯 [onInvitationCreated] Invitation data", {
      email: data.email,
      orgName: data.orgName,
      role: data.role,
      invitedBy: data.invitedBy,
    });

    const inviterSnap = await db.doc(`users/${data.invitedBy}`).get();
    const inviterName = inviterSnap.exists
      ? inviterSnap.data()?.displayName || "A team member"
      : "A team member";

    const appUrl = `https://${process.env.GCLOUD_PROJECT}.web.app`;

    const email = invitationEmail({
      inviteeEmail: data.email,
      orgName: data.orgName,
      role: data.role,
      inviterName,
      appUrl,
    });

    try {
      await sendEmail({
        to: data.email,
        subject: email.subject,
        html: email.html,
      });
      logger.info("🎯 [onInvitationCreated] ✅ Email dispatched", { to: data.email });
    } catch (err: any) {
      logger.error("🎯 [onInvitationCreated] ❌ Failed", {
        to: data.email,
        error: err.message,
      });
    }
  }
);

// ================================================================
// 2. WELCOME EMAIL — triggered when /users/{uid} is created
// ================================================================

export const onUserCreated = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    logger.info("🎯 [onUserCreated] Triggered", { userId });

    const data = event.data?.data();
    if (!data) {
      logger.warn("🎯 [onUserCreated] No data in event — skipping");
      return;
    }

    logger.info("🎯 [onUserCreated] User data", {
      email: data.email,
      displayName: data.displayName,
    });

    const appUrl = `https://${process.env.GCLOUD_PROJECT}.web.app`;

    const email = welcomeEmail({
      displayName: data.displayName || "there",
      email: data.email,
      appUrl,
    });

    try {
      await sendEmail({
        to: data.email,
        subject: email.subject,
        html: email.html,
      });
      logger.info("🎯 [onUserCreated] ✅ Welcome email dispatched", { to: data.email });
    } catch (err: any) {
      logger.error("🎯 [onUserCreated] ❌ Failed", {
        to: data.email,
        error: err.message,
      });
    }
  }
);

// ================================================================
// 3. SEND INVOICE EMAIL — callable from client
// ================================================================

export const sendInvoiceEmail = onCall(
  { cors: true },
  async (request) => {
    logger.info("🎯 [sendInvoiceEmail] Called", {
      uid: request.auth?.uid,
      orgId: request.data?.orgId,
      invoiceId: request.data?.invoiceId,
    });

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { orgId, invoiceId } = request.data;
    if (!orgId || !invoiceId) {
      throw new HttpsError("invalid-argument", "orgId and invoiceId required");
    }

    // Verify caller is a member
    const memberSnap = await db
      .doc(`organizations/${orgId}/members/${request.auth.uid}`)
      .get();
    if (!memberSnap.exists) {
      throw new HttpsError("permission-denied", "Not a member of this org");
    }

    // Get invoice
    const invSnap = await db
      .doc(`organizations/${orgId}/salesInvoices/${invoiceId}`)
      .get();
    if (!invSnap.exists) {
      throw new HttpsError("not-found", "Invoice not found");
    }
    const inv = invSnap.data()!;

    // Get customer
    const custSnap = await db
      .doc(`organizations/${orgId}/customers/${inv.customerId}`)
      .get();
    const customer = custSnap.data();
    if (!customer?.email) {
      throw new HttpsError(
        "failed-precondition",
        "Customer has no email address"
      );
    }

    // Get org
    const orgSnap = await db.doc(`organizations/${orgId}`).get();
    const org = orgSnap.data()!;

    const email = invoiceEmail({
      customerName: customer.name || "Customer",
      customerEmail: customer.email,
      orgName: org.name,
      invoiceNumber: inv.number,
      invoiceDate: formatFirestoreDate(inv.date),
      dueDate: formatFirestoreDate(inv.dueDate),
      currency: org.currency || "GHS",
      lines: inv.lines || [],
      subtotal: inv.subtotal || 0,
      taxTotal: inv.taxTotal || 0,
      total: inv.total || 0,
      amountDue: inv.amountDue || 0,
      notes: inv.notes,
    });

    await sendEmail({
      to: customer.email,
      subject: email.subject,
      html: email.html,
    });

    // Update invoice status to 'sent' if it's still draft
    if (inv.status === "draft") {
      await invSnap.ref.update({ status: "sent", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    logger.info("🎯 [sendInvoiceEmail] ✅ Done", { to: customer.email, invoiceNumber: inv.number });
    return { success: true, sentTo: customer.email };
  }
);

// ================================================================
// 4. PAYMENT RECEIPT EMAIL — triggered when receipt is created
// ================================================================

export const onReceiptCreated = onDocumentCreated(
  "organizations/{orgId}/receipts/{receiptId}",
  async (event) => {
    const orgId = event.params.orgId;
    const receiptId = event.params.receiptId;
    logger.info("🎯 [onReceiptCreated] Triggered", { orgId, receiptId });

    const data = event.data?.data();
    if (!data) {
      logger.warn("🎯 [onReceiptCreated] No data in event — skipping");
      return;
    }

    // Get customer
    const custSnap = await db
      .doc(`organizations/${orgId}/customers/${data.customerId}`)
      .get();
    const customer = custSnap.data();
    if (!customer?.email) {
      logger.warn("🎯 [onReceiptCreated] Customer has no email — skipping", { customerId: data.customerId });
      return;
    }

    // Get invoice
    const invSnap = await db
      .doc(`organizations/${orgId}/salesInvoices/${data.invoiceId}`)
      .get();
    const inv = invSnap.data();
    if (!inv) {
      logger.warn("🎯 [onReceiptCreated] Invoice not found — skipping", { invoiceId: data.invoiceId });
      return;
    }

    // Get org
    const orgSnap = await db.doc(`organizations/${orgId}`).get();
    const org = orgSnap.data()!;

    const email = paymentReceiptEmail({
      customerName: customer.name || "Customer",
      orgName: org.name,
      invoiceNumber: inv.number,
      paymentDate: formatFirestoreDate(data.date),
      amount: data.amount,
      method: data.method || "",
      reference: data.reference || "",
      currency: org.currency || "GHS",
      remainingBalance: inv.amountDue || 0,
    });

    try {
      await sendEmail({
        to: customer.email,
        subject: email.subject,
        html: email.html,
      });
      logger.info("🎯 [onReceiptCreated] ✅ Receipt email dispatched", { to: customer.email });
    } catch (err: any) {
      logger.error("🎯 [onReceiptCreated] ❌ Failed", { to: customer.email, error: err.message });
    }
  }
);

// ================================================================
// 5. SEND BILL TO SELF (notify org of new bill) — callable
// ================================================================

export const sendBillNotification = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { orgId, billId, recipientEmail } = request.data;
    if (!orgId || !billId || !recipientEmail) {
      throw new HttpsError(
        "invalid-argument",
        "orgId, billId, and recipientEmail required"
      );
    }

    const memberSnap = await db
      .doc(`organizations/${orgId}/members/${request.auth.uid}`)
      .get();
    if (!memberSnap.exists) {
      throw new HttpsError("permission-denied", "Not a member of this org");
    }

    const billSnap = await db
      .doc(`organizations/${orgId}/purchaseInvoices/${billId}`)
      .get();
    if (!billSnap.exists) {
      throw new HttpsError("not-found", "Bill not found");
    }
    const bill = billSnap.data()!;

    const orgSnap = await db.doc(`organizations/${orgId}`).get();
    const org = orgSnap.data()!;

    const supplierSnap = await db
      .doc(`organizations/${orgId}/suppliers/${bill.supplierId}`)
      .get();
    const supplier = supplierSnap.data();

    // Reuse invoice template for bill notification
    const email = invoiceEmail({
      customerName: supplier?.name || "Supplier",
      customerEmail: recipientEmail,
      orgName: org.name,
      invoiceNumber: `Bill ${bill.number}`,
      invoiceDate: formatFirestoreDate(bill.date),
      dueDate: formatFirestoreDate(bill.dueDate),
      currency: org.currency || "GHS",
      lines: bill.lines || [],
      subtotal: bill.subtotal || 0,
      taxTotal: bill.taxTotal || 0,
      total: bill.total || 0,
      amountDue: bill.amountDue || 0,
      notes: bill.notes,
    });

    await sendEmail({
      to: recipientEmail,
      subject: `Bill ${bill.number} from ${supplier?.name || "Supplier"} — ${org.name}`,
      html: email.html,
    });

    return { success: true, sentTo: recipientEmail };
  }
);

// ---- Helper ----

function formatFirestoreDate(ts: any): string {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
