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
import { DEFAULT_CHART } from "./chartOfAccounts";
import { seedTaxCodesFor } from "./taxCodes";

admin.initializeApp();
const db = admin.firestore();

// Sales-side GL posting triggers (invoice / receipt / credit-note → journal entries).
export {
  onSalesInvoiceWritten,
  onReceiptWritten,
  onCreditNoteWritten,
} from "./salesPosting";

// Purchases-side GL posting triggers (bill / payment / debit-note → journal entries).
export {
  onBillWritten,
  onPaymentWritten,
  onDebitNoteWritten,
} from "./purchasesPosting";

// Banking-side GL posting trigger (deposits / withdrawals / transfers → journal entries).
export { onBankTransactionWritten } from "./bankingPosting";

// One-time (re-runnable) backfill of pre-existing subledger docs into the ledger.
export { backfillLedger } from "./backfill";

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

// ================================================================
// CHART OF ACCOUNTS SEEDING
// Every new org gets a standard chart of accounts with tagged control
// accounts, so the posting engine has AR/AP/Tax/etc. to post into.
// ================================================================

/**
 * Seed the default chart of accounts for an org. Idempotent: if the org already
 * has any accounts, it does nothing. Returns the number of accounts created.
 */
async function seedChartOfAccountsFor(orgId: string): Promise<number> {
  const accountsRef = db.collection(`organizations/${orgId}/accounts`);
  const existing = await accountsRef.limit(1).get();
  if (!existing.empty) {
    logger.info("[seedChart] org already has accounts — skipping", { orgId });
    return 0;
  }

  const orgSnap = await db.doc(`organizations/${orgId}`).get();
  const currency = orgSnap.data()?.currency || "GHS";

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  for (const acc of DEFAULT_CHART) {
    const ref = accountsRef.doc();
    batch.set(ref, {
      code: acc.code,
      name: acc.name,
      type: acc.type,
      parentId: null,
      currency,
      isActive: true,
      balance: 0,
      description: acc.description || "",
      systemType: acc.systemType || null,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  logger.info("[seedChart] seeded default chart of accounts", { orgId, count: DEFAULT_CHART.length });
  return DEFAULT_CHART.length;
}

// Auto-seed on org creation.
export const onOrganizationCreated = onDocumentCreated(
  "organizations/{orgId}",
  async (event) => {
    const orgId = event.params.orgId;
    try {
      await seedChartOfAccountsFor(orgId);
      await seedTaxCodesFor(orgId);
    } catch (err: any) {
      logger.error("[onOrganizationCreated] seeding failed", { orgId, message: err?.message });
    }
  }
);

// Backfill callable — seed the chart for an existing org that has none.
// Caller must be an owner/admin of that org (or super admin).
export const seedChartOfAccounts = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const orgId = request.data?.orgId as string;
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required.");

  const memberSnap = await db.doc(`organizations/${orgId}/members/${uid}`).get();
  const role = memberSnap.data()?.role;
  const userSnap = await db.doc(`users/${uid}`).get();
  const isSuperAdmin = userSnap.data()?.platformRole === "super_admin";
  if (!isSuperAdmin && role !== "owner" && role !== "admin") {
    throw new HttpsError("permission-denied", "Only an owner, admin, or super admin can seed accounts.");
  }

  const created = await seedChartOfAccountsFor(orgId);
  const taxCodesCreated = await seedTaxCodesFor(orgId);
  return { success: true, created, taxCodesCreated };
});

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
