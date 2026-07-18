// One-time (re-runnable) backfill: sweeps an org's existing subledger documents and
// posts them to the general ledger via the same idempotent reconciler the live triggers
// use. Safe to run repeatedly — already-posted documents whose `glHash` matches are
// left untouched. Requires the org's chart of accounts to be seeded first (documents
// whose control accounts can't be resolved are counted as errors and skipped, not fatal).

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { reconcileDocumentPosting, ReconcileAction, DesiredEntry } from "./posting";
import { buildInvoiceEntry, buildReceiptEntry, buildCreditNoteEntry } from "./salesPosting";
import { buildBillEntry, buildPaymentEntry, buildDebitNoteEntry } from "./purchasesPosting";
import { buildBankTransactionEntry } from "./bankingPosting";

type Builder = (orgId: string, data: any) => Promise<DesiredEntry | null>;

interface CollectionSpec {
  name: string;
  sourceType: string;
  build: Builder;
}

/**
 * Idempotently tag the Inventory (1200) and COGS (5000) accounts as system accounts
 * on orgs whose chart predates perpetual inventory. Without these tags the posting
 * engine can't resolve where to book stock/COGS. Safe to call repeatedly — it only
 * writes when the tag is missing and no other account already claims it.
 */
export async function ensureInventoryAccountTags(orgId: string): Promise<void> {
  const db = admin.firestore();
  const col = db.collection(`organizations/${orgId}/accounts`);
  const tags: Array<{ code: string; systemType: string }> = [
    { code: "1200", systemType: "inventory" },
    { code: "5000", systemType: "cogs" },
  ];
  for (const { code, systemType } of tags) {
    const alreadyTagged = await col.where("systemType", "==", systemType).limit(1).get();
    if (!alreadyTagged.empty) continue;
    const byCode = await col.where("code", "==", code).limit(1).get();
    if (byCode.empty) continue;
    await byCode.docs[0].ref.update({
      systemType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info("[backfill] tagged system account", { orgId, code, systemType });
  }
}

const COLLECTIONS: CollectionSpec[] = [
  { name: "salesInvoices", sourceType: "salesInvoice", build: buildInvoiceEntry },
  { name: "receipts", sourceType: "receipt", build: buildReceiptEntry },
  { name: "creditNotes", sourceType: "creditNote", build: buildCreditNoteEntry },
  { name: "purchaseInvoices", sourceType: "bill", build: buildBillEntry },
  { name: "payments", sourceType: "payment", build: buildPaymentEntry },
  { name: "debitNotes", sourceType: "debitNote", build: buildDebitNoteEntry },
  { name: "bankTransactions", sourceType: "bankTransaction", build: buildBankTransactionEntry },
];

export const backfillLedger = onCall(
  { timeoutSeconds: 540, memory: "512MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const orgId = request.data?.orgId as string;
    if (!orgId) throw new HttpsError("invalid-argument", "orgId is required.");

    const db = admin.firestore();

    // Authorize: super admin, or owner/admin of the org.
    const memberSnap = await db.doc(`organizations/${orgId}/members/${uid}`).get();
    const role = memberSnap.data()?.role;
    const userSnap = await db.doc(`users/${uid}`).get();
    const isSuperAdmin = userSnap.data()?.platformRole === "super_admin";
    if (!isSuperAdmin && role !== "owner" && role !== "admin") {
      throw new HttpsError("permission-denied", "Only an owner, admin, or super admin can backfill the ledger.");
    }

    // Guard: the chart of accounts must be seeded, or every build fails.
    const accountsSnap = await db.collection(`organizations/${orgId}/accounts`).limit(1).get();
    if (accountsSnap.empty) {
      throw new HttpsError("failed-precondition", "Seed the chart of accounts before backfilling the ledger.");
    }

    // Tag Inventory/COGS system accounts on legacy charts so inventory posting resolves.
    await ensureInventoryAccountTags(orgId);

    logger.info("[backfill] starting", { orgId, by: uid });

    const summary: Record<string, { total: number; created: number; unchanged: number; deleted: number; errors: number }> = {};
    let grandTotal = 0;
    let grandCreated = 0;

    for (const spec of COLLECTIONS) {
      const counts = { total: 0, created: 0, unchanged: 0, deleted: 0, errors: 0 };
      const snap = await db.collection(`organizations/${orgId}/${spec.name}`).get();
      for (const doc of snap.docs) {
        counts.total++;
        grandTotal++;
        let action: ReconcileAction;
        try {
          action = await reconcileDocumentPosting({
            orgId,
            sourceRef: doc.ref,
            before: undefined,
            after: doc.data(),
            sourceType: spec.sourceType,
            build: (d) => spec.build(orgId, d),
          });
        } catch (e: any) {
          logger.error("[backfill] reconcile threw", { orgId, collection: spec.name, docId: doc.id, message: e?.message });
          counts.errors++;
          continue;
        }
        if (action === "created") { counts.created++; grandCreated++; }
        else if (action === "unchanged") counts.unchanged++;
        else if (action === "deleted") counts.deleted++;
        else if (action === "error") counts.errors++;
      }
      summary[spec.name] = counts;
      logger.info("[backfill] collection done", { orgId, collection: spec.name, ...counts });
    }

    logger.info("[backfill] complete", { orgId, grandTotal, grandCreated });
    return { success: true, orgId, grandTotal, grandCreated, summary };
  }
);
