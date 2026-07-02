// Purchases-side GL posting. Keeps the general ledger in step with the purchase
// subledger:
//   • Bill (non-draft, non-void):  DR Expense (per line) / DR Tax Payable (input VAT) / CR Accounts Payable
//   • Payment:                     DR Accounts Payable / CR Bank
//   • Debit note:                  DR Accounts Payable / CR Expense (per line) / CR Tax Payable
// All three are idempotent and self-reversing via reconcileDocumentPosting().

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  reconcileDocumentPosting,
  resolveSystemAccounts,
  groupNetByAccount,
  taxPostingLines,
  round2,
  DesiredEntry,
  PostingLine,
} from "./posting";

// ---- Bill (purchase invoice) ----

export async function buildBillEntry(orgId: string, bill: any): Promise<DesiredEntry | null> {
  const status = bill?.status;
  if (!bill || status === "draft" || status === "void") return null;

  const accts = await resolveSystemAccounts(orgId, ["accounts_payable", "tax_payable", "purchases"]);
  const apId = accts.accounts_payable;
  if (!apId) throw new Error("no accounts_payable control account (seed the chart of accounts)");

  const byAccount = groupNetByAccount(bill.lines, accts.purchases);
  const lines: PostingLine[] = [];
  let debitSum = 0;
  for (const [acct, amt] of byAccount) {
    lines.push({ accountId: acct, debit: amt, credit: 0, description: `Bill ${bill.number || ""}` });
    debitSum = round2(debitSum + amt);
  }

  // Input VAT/levies reduce the net tax owed → debit the tax liability account(s).
  const tax = taxPostingLines(bill, "debit", `on bill ${bill.number || ""}`, accts.tax_payable);
  lines.push(...tax.lines);
  debitSum = round2(debitSum + tax.total);

  if (debitSum < 0.005) return null; // all-zero bill — nothing to post

  // CR AP for the full debit sum so the entry always balances regardless of drift.
  lines.unshift({
    accountId: apId,
    debit: 0,
    credit: debitSum,
    description: `Bill ${bill.number || ""}${bill.supplierName ? " — " + bill.supplierName : ""}`,
  });

  return {
    date: bill.date,
    reference: bill.number || "",
    memo: `Bill ${bill.number || ""}`.trim(),
    lines,
  };
}

export const onBillWritten = onDocumentWritten(
  "organizations/{orgId}/purchaseInvoices/{billId}",
  async (event) => {
    const ref = event.data?.after?.ref || event.data?.before?.ref;
    if (!ref) return;
    await reconcileDocumentPosting({
      orgId: event.params.orgId,
      sourceRef: ref,
      before: event.data?.before?.data(),
      after: event.data?.after?.data(),
      sourceType: "bill",
      build: (data) => buildBillEntry(event.params.orgId, data),
    });
  }
);

// ---- Payment (to supplier) ----

export async function buildPaymentEntry(orgId: string, p: any): Promise<DesiredEntry | null> {
  if (!p) return null;
  const amount = round2(p.amount || 0);
  if (amount < 0.005) return null;

  const accts = await resolveSystemAccounts(orgId, ["bank", "accounts_payable"]);
  if (!accts.accounts_payable) throw new Error("no accounts_payable control account (seed the chart of accounts)");
  if (!accts.bank) throw new Error("no bank control account (seed the chart of accounts)");

  const lines: PostingLine[] = [
    { accountId: accts.accounts_payable, debit: amount, credit: 0, description: "Payment applied to payables" },
    { accountId: accts.bank, debit: 0, credit: amount, description: `Supplier payment${p.reference ? " — " + p.reference : ""}` },
  ];

  return {
    date: p.date,
    reference: p.reference || "Payment",
    memo: "Supplier payment",
    lines,
  };
}

export const onPaymentWritten = onDocumentWritten(
  "organizations/{orgId}/payments/{paymentId}",
  async (event) => {
    const ref = event.data?.after?.ref || event.data?.before?.ref;
    if (!ref) return;
    await reconcileDocumentPosting({
      orgId: event.params.orgId,
      sourceRef: ref,
      before: event.data?.before?.data(),
      after: event.data?.after?.data(),
      sourceType: "payment",
      build: (data) => buildPaymentEntry(event.params.orgId, data),
    });
  }
);

// ---- Debit note (reversal of a purchase) ----

export async function buildDebitNoteEntry(orgId: string, dn: any): Promise<DesiredEntry | null> {
  if (!dn) return null;

  const accts = await resolveSystemAccounts(orgId, ["accounts_payable", "tax_payable", "purchases"]);
  const apId = accts.accounts_payable;
  if (!apId) throw new Error("no accounts_payable control account (seed the chart of accounts)");

  const byAccount = groupNetByAccount(dn.lines, accts.purchases);
  const lines: PostingLine[] = [];
  let creditSum = 0;
  for (const [acct, amt] of byAccount) {
    lines.push({ accountId: acct, debit: 0, credit: amt, description: `Debit note ${dn.number || ""}` });
    creditSum = round2(creditSum + amt);
  }

  const tax = taxPostingLines(dn, "credit", `on debit note ${dn.number || ""}`, accts.tax_payable);
  lines.push(...tax.lines);
  creditSum = round2(creditSum + tax.total);

  if (creditSum < 0.005) return null;

  lines.unshift({
    accountId: apId,
    debit: creditSum,
    credit: 0,
    description: `Debit note ${dn.number || ""}${dn.supplierName ? " — " + dn.supplierName : ""}`,
  });

  return {
    date: dn.date,
    reference: dn.number || "",
    memo: `Debit note ${dn.number || ""}`.trim(),
    lines,
  };
}

export const onDebitNoteWritten = onDocumentWritten(
  "organizations/{orgId}/debitNotes/{debitNoteId}",
  async (event) => {
    const ref = event.data?.after?.ref || event.data?.before?.ref;
    if (!ref) return;
    await reconcileDocumentPosting({
      orgId: event.params.orgId,
      sourceRef: ref,
      before: event.data?.before?.data(),
      after: event.data?.after?.data(),
      sourceType: "debitNote",
      build: (data) => buildDebitNoteEntry(event.params.orgId, data),
    });
  }
);
