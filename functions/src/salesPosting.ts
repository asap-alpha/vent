// Sales-side GL posting. Keeps the general ledger in step with the sales subledger:
//   • Invoice (non-draft, non-void):  DR Accounts Receivable / CR Revenue (per line) / CR Tax Payable
//   • Receipt:                        DR Bank / CR Accounts Receivable
//   • Credit note:                    DR Revenue (per line) / DR Tax Payable / CR Accounts Receivable
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

// ---- Invoice ----

export async function buildInvoiceEntry(orgId: string, inv: any): Promise<DesiredEntry | null> {
  const status = inv?.status;
  if (!inv || status === "draft" || status === "void") return null;

  const accts = await resolveSystemAccounts(orgId, ["accounts_receivable", "tax_payable", "sales", "inventory", "cogs"]);
  const arId = accts.accounts_receivable;
  if (!arId) throw new Error("no accounts_receivable control account (seed the chart of accounts)");

  const byAccount = groupNetByAccount(inv.lines, accts.sales);
  const lines: PostingLine[] = [];
  let creditSum = 0;
  for (const [acct, amt] of byAccount) {
    lines.push({ accountId: acct, debit: 0, credit: amt, description: `Invoice ${inv.number || ""}` });
    creditSum = round2(creditSum + amt);
  }

  const tax = taxPostingLines(inv, "credit", `on invoice ${inv.number || ""}`, accts.tax_payable);
  lines.push(...tax.lines);
  creditSum = round2(creditSum + tax.total);

  if (creditSum < 0.005) return null; // all-zero invoice — nothing to post

  // DR AR for the full credit sum so the entry always balances, even if the stored
  // total drifted from the recomputed line sum.
  lines.unshift({
    accountId: arId,
    debit: creditSum,
    credit: 0,
    description: `Invoice ${inv.number || ""}${inv.customerName ? " — " + inv.customerName : ""}`,
  });

  // Cost of goods sold: the inventory engine stamps each inventory line's weighted-average
  // cost onto `line.cost`. Fold a DR COGS / CR Inventory pair (self-balancing) into this
  // same entry. Skipped cleanly if the org has no inventory/COGS accounts tagged.
  const cogsTotal = round2(
    (inv.lines || []).reduce((s: number, l: any) => s + (l?.itemId && l?.cost ? l.cost : 0), 0)
  );
  if (cogsTotal >= 0.005 && accts.cogs && accts.inventory) {
    lines.push({ accountId: accts.cogs, debit: cogsTotal, credit: 0, description: `Cost of goods sold — invoice ${inv.number || ""}`.trim() });
    lines.push({ accountId: accts.inventory, debit: 0, credit: cogsTotal, description: `Inventory sold — invoice ${inv.number || ""}`.trim() });
  }

  return {
    date: inv.date,
    reference: inv.number || "",
    memo: `Invoice ${inv.number || ""}`.trim(),
    lines,
  };
}

export const onSalesInvoiceWritten = onDocumentWritten(
  "organizations/{orgId}/salesInvoices/{invoiceId}",
  async (event) => {
    const ref = event.data?.after?.ref || event.data?.before?.ref;
    if (!ref) return;
    await reconcileDocumentPosting({
      orgId: event.params.orgId,
      sourceRef: ref,
      before: event.data?.before?.data(),
      after: event.data?.after?.data(),
      sourceType: "salesInvoice",
      build: (data) => buildInvoiceEntry(event.params.orgId, data),
    });
  }
);

// ---- Receipt (customer payment) ----

export async function buildReceiptEntry(orgId: string, r: any): Promise<DesiredEntry | null> {
  if (!r) return null;
  // A voided receipt keeps its document (audit trail) but posts no GL entry, so
  // reconcileDocumentPosting drops any previously-posted entry — same as a void invoice.
  if (r.status === "void") return null;
  const amount = round2(r.amount || 0);
  if (amount < 0.005) return null;

  const accts = await resolveSystemAccounts(orgId, ["bank", "accounts_receivable"]);
  if (!accts.accounts_receivable) throw new Error("no accounts_receivable control account (seed the chart of accounts)");
  if (!accts.bank) throw new Error("no bank control account (seed the chart of accounts)");

  const lines: PostingLine[] = [
    { accountId: accts.bank, debit: amount, credit: 0, description: `Payment received${r.reference ? " — " + r.reference : ""}` },
    { accountId: accts.accounts_receivable, debit: 0, credit: amount, description: "Payment applied to receivables" },
  ];

  return {
    date: r.date,
    reference: r.reference || "Receipt",
    memo: "Customer payment",
    lines,
  };
}

export const onReceiptWritten = onDocumentWritten(
  "organizations/{orgId}/receipts/{receiptId}",
  async (event) => {
    const ref = event.data?.after?.ref || event.data?.before?.ref;
    if (!ref) return;
    await reconcileDocumentPosting({
      orgId: event.params.orgId,
      sourceRef: ref,
      before: event.data?.before?.data(),
      after: event.data?.after?.data(),
      sourceType: "receipt",
      build: (data) => buildReceiptEntry(event.params.orgId, data),
    });
  }
);

// ---- Credit note (reversal of revenue) ----

export async function buildCreditNoteEntry(orgId: string, cn: any): Promise<DesiredEntry | null> {
  if (!cn) return null;

  const accts = await resolveSystemAccounts(orgId, ["accounts_receivable", "tax_payable", "sales"]);
  const arId = accts.accounts_receivable;
  if (!arId) throw new Error("no accounts_receivable control account (seed the chart of accounts)");

  const byAccount = groupNetByAccount(cn.lines, accts.sales);
  const lines: PostingLine[] = [];
  let debitSum = 0;
  for (const [acct, amt] of byAccount) {
    lines.push({ accountId: acct, debit: amt, credit: 0, description: `Credit note ${cn.number || ""}` });
    debitSum = round2(debitSum + amt);
  }

  const tax = taxPostingLines(cn, "debit", `on credit note ${cn.number || ""}`, accts.tax_payable);
  lines.push(...tax.lines);
  debitSum = round2(debitSum + tax.total);

  if (debitSum < 0.005) return null;

  lines.unshift({
    accountId: arId,
    debit: 0,
    credit: debitSum,
    description: `Credit note ${cn.number || ""}${cn.customerName ? " — " + cn.customerName : ""}`,
  });

  return {
    date: cn.date,
    reference: cn.number || "",
    memo: `Credit note ${cn.number || ""}`.trim(),
    lines,
  };
}

export const onCreditNoteWritten = onDocumentWritten(
  "organizations/{orgId}/creditNotes/{creditNoteId}",
  async (event) => {
    const ref = event.data?.after?.ref || event.data?.before?.ref;
    if (!ref) return;
    await reconcileDocumentPosting({
      orgId: event.params.orgId,
      sourceRef: ref,
      before: event.data?.before?.data(),
      after: event.data?.after?.data(),
      sourceType: "creditNote",
      build: (data) => buildCreditNoteEntry(event.params.orgId, data),
    });
  }
);
