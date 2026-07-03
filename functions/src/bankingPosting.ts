// Banking-side GL posting. Keeps the general ledger in step with cash movements:
//   • Deposit:     DR Bank (GL) / CR Category account
//   • Withdrawal:  DR Category account / CR Bank (GL)
//   • Transfer:    DR Destination bank (GL) / CR Source bank (GL)  — posted once, on the
//                  outflow leg; the paired inflow leg posts nothing to avoid double-counting.
//
// Each bank account links to a GL asset account via `glAccountId` (falling back to the
// tagged `bank` system account). A normal deposit/withdrawal needs a `categoryAccountId`
// (the contra account) — until one is set the transaction stays UNPOSTED rather than
// guessing an account and corrupting the P&L.

import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  reconcileDocumentPosting,
  resolveSystemAccountId,
  round2,
  DesiredEntry,
} from "./posting";

/** Resolve the GL asset account a bank account posts to, or the `bank` system account. */
async function resolveBankGlId(orgId: string, bankAccountId: string): Promise<string | null> {
  const db = admin.firestore();
  const snap = await db.doc(`organizations/${orgId}/bankAccounts/${bankAccountId}`).get();
  const linked = snap.data()?.glAccountId as string | undefined;
  if (linked) return linked;
  return resolveSystemAccountId(orgId, "bank");
}

export async function buildBankTransactionEntry(orgId: string, txn: any): Promise<DesiredEntry | null> {
  if (!txn) return null;
  const amount = round2(txn.amount || 0);
  if (amount < 0.005) return null;

  const bankGlId = await resolveBankGlId(orgId, txn.bankAccountId);
  if (!bankGlId) throw new Error("no bank GL account (link the bank account or seed the chart of accounts)");

  const type = txn.type;

  // The inflow leg of a transfer is handled by its paired outflow leg — skip it.
  if (type === "deposit" && txn.transferAccountId) return null;

  // Transfer (outflow leg): move cash between the two banks' GL accounts.
  if (type === "transfer") {
    if (!txn.transferAccountId) return null;
    const toGlId = await resolveBankGlId(orgId, txn.transferAccountId);
    if (!toGlId) throw new Error("no destination bank GL account");
    if (toGlId === bankGlId) return null; // both map to the same GL account — no net effect

    return {
      date: txn.date,
      reference: txn.reference || "Transfer",
      memo: txn.description || `Transfer${txn.payee ? " — " + txn.payee : ""}`,
      lines: [
        { accountId: toGlId, debit: amount, credit: 0, description: txn.payee || "Transfer in" },
        { accountId: bankGlId, debit: 0, credit: amount, description: txn.payee || "Transfer out" },
      ],
    };
  }

  // Normal deposit / withdrawal — needs a contra (category) account to post.
  const categoryId = txn.categoryAccountId as string | undefined;
  if (!categoryId) return null; // uncategorized — leave unposted
  if (categoryId === bankGlId) return null;

  const desc = txn.description || txn.payee || txn.category || (type === "deposit" ? "Deposit" : "Withdrawal");
  const lines =
    type === "deposit"
      ? [
          { accountId: bankGlId, debit: amount, credit: 0, description: desc },
          { accountId: categoryId, debit: 0, credit: amount, description: desc },
        ]
      : [
          { accountId: categoryId, debit: amount, credit: 0, description: desc },
          { accountId: bankGlId, debit: 0, credit: amount, description: desc },
        ];

  return {
    date: txn.date,
    reference: txn.reference || "",
    memo: desc,
    lines,
  };
}

export const onBankTransactionWritten = onDocumentWritten(
  "organizations/{orgId}/bankTransactions/{txnId}",
  async (event) => {
    const ref = event.data?.after?.ref || event.data?.before?.ref;
    if (!ref) return;
    await reconcileDocumentPosting({
      orgId: event.params.orgId,
      sourceRef: ref,
      before: event.data?.before?.data(),
      after: event.data?.after?.data(),
      sourceType: "bankTransaction",
      build: (data) => buildBankTransactionEntry(event.params.orgId, data),
    });
  }
);
