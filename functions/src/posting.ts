// Server-authoritative posting engine. Subledger documents (invoices, receipts,
// bills, bank transactions…) are the source of truth the user edits; this module
// keeps a matching balanced entry in the general ledger (`journalEntries`) so every
// financial report can read from one place. Entries written here are tagged
// `autoPosted: true` with a `source` pointer so they can be reconciled/reversed.
//
// Design: each source document carries two managed fields — `journalEntryId` (the
// GL entry it produced) and `glHash` (a deterministic signature of what was posted).
// On every write we recompute the desired GL entry, compare its hash to `glHash`,
// and only touch the ledger when they differ. Our own metadata write-back therefore
// converges after one no-op re-trigger instead of looping.

import * as admin from "firebase-admin";
import { createHash } from "crypto";
import { logger } from "firebase-functions";
import { SystemAccountType } from "./chartOfAccounts";

export interface PostingLine {
  accountId: string;
  accountName?: string;
  debit: number;
  credit: number;
  description: string;
}

export interface DesiredEntry {
  date: FirebaseFirestore.Timestamp | Date;
  reference: string;
  memo: string;
  lines: PostingLine[];
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Sum tax-exclusive line net amounts (qty × unit price) grouped by account. Lines
 * without their own account fall back to `fallbackAccountId`; if that too is missing
 * it throws, so a misconfigured chart fails loudly instead of posting to nowhere.
 */
export function groupNetByAccount(lines: any[], fallbackAccountId?: string): Map<string, number> {
  const byAccount = new Map<string, number>();
  for (const l of lines || []) {
    const net = round2((l.quantity || 0) * (l.unitPrice || 0));
    if (net === 0) continue;
    const acct = l.accountId || fallbackAccountId;
    if (!acct) throw new Error("line has no account and no default system account is configured");
    byAccount.set(acct, round2((byAccount.get(acct) || 0) + net));
  }
  return byAccount;
}

/**
 * Build the tax leg(s) of a document's entry. When the doc carries a `taxLines`
 * breakdown (from tax codes), each tax account is posted separately — VAT and each
 * levy to its own liability account. Otherwise falls back to a single posting of
 * `taxTotal` to the Tax Payable control account. `side` is the natural side for this
 * document type (credit for sales, debit for purchases; reversed for notes).
 */
export function taxPostingLines(
  doc: any,
  side: "debit" | "credit",
  label: string,
  fallbackAccountId?: string
): { lines: PostingLine[]; total: number } {
  const out: PostingLine[] = [];
  let total = 0;
  const push = (accountId: string, amount: number, name: string) => {
    out.push(
      side === "debit"
        ? { accountId, debit: amount, credit: 0, description: `${name} ${label}`.trim() }
        : { accountId, debit: 0, credit: amount, description: `${name} ${label}`.trim() }
    );
    total = round2(total + amount);
  };

  if (Array.isArray(doc.taxLines) && doc.taxLines.length) {
    for (const t of doc.taxLines) {
      const amt = round2(t.amount || 0);
      if (amt < 0.005 || !t.accountId) continue;
      push(t.accountId, amt, t.name || "Tax");
    }
    return { lines: out, total };
  }

  const taxTotal = round2(doc.taxTotal || 0);
  if (taxTotal >= 0.005) {
    if (!fallbackAccountId) throw new Error("no tax_payable control account (seed the chart of accounts)");
    push(fallbackAccountId, taxTotal, "Tax");
  }
  return { lines: out, total };
}

/** Resolve a tagged control/system account's id for an org, or null if unseeded. */
export async function resolveSystemAccountId(
  orgId: string,
  systemType: SystemAccountType
): Promise<string | null> {
  const db = admin.firestore();
  const snap = await db
    .collection(`organizations/${orgId}/accounts`)
    .where("systemType", "==", systemType)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

/** Resolve several system accounts at once. Returns a map keyed by system type. */
export async function resolveSystemAccounts(
  orgId: string,
  types: SystemAccountType[]
): Promise<Partial<Record<SystemAccountType, string>>> {
  const out: Partial<Record<SystemAccountType, string>> = {};
  await Promise.all(
    types.map(async (t) => {
      const id = await resolveSystemAccountId(orgId, t);
      if (id) out[t] = id;
    })
  );
  return out;
}

function toMillis(d: FirebaseFirestore.Timestamp | Date): number {
  if (d instanceof Date) return d.getTime();
  return d.toMillis();
}

/** Deterministic signature of a desired entry — drives idempotent reconciliation. */
function hashEntry(entry: DesiredEntry | null): string {
  if (!entry) return "";
  const canonical = {
    d: toMillis(entry.date),
    r: entry.reference,
    m: entry.memo,
    l: entry.lines.map((l) => [l.accountId, round2(l.debit), round2(l.credit), l.description]),
  };
  return createHash("sha1").update(JSON.stringify(canonical)).digest("hex");
}

/** Validate a desired entry balances and has ≥2 lines before it ever hits the GL. */
function assertBalanced(entry: DesiredEntry, ctx: string): void {
  const debit = round2(entry.lines.reduce((s, l) => s + (l.debit || 0), 0));
  const credit = round2(entry.lines.reduce((s, l) => s + (l.credit || 0), 0));
  if (entry.lines.length < 2) {
    throw new Error(`[posting] ${ctx}: entry needs ≥2 lines`);
  }
  if (Math.abs(debit - credit) >= 0.005) {
    throw new Error(`[posting] ${ctx}: unbalanced (DR ${debit} vs CR ${credit})`);
  }
}

/**
 * Reconcile the GL against a single source document. Idempotent and safe to call on
 * every onDocumentWritten invocation.
 *
 * @param opts.orgId     organization id
 * @param opts.sourceRef the source document's ref (used to write back managed fields)
 * @param opts.before    document data before the write (undefined on create)
 * @param opts.after     document data after the write (undefined on delete)
 * @param opts.sourceType label stored on the GL entry (e.g. "salesInvoice")
 * @param opts.build     builds the desired GL entry from the current doc, or returns
 *                       null when the doc should carry NO ledger entry (draft/void).
 */
export type ReconcileAction = "created" | "deleted" | "unchanged" | "skipped" | "error";

export async function reconcileDocumentPosting(opts: {
  orgId: string;
  sourceRef: FirebaseFirestore.DocumentReference;
  before?: FirebaseFirestore.DocumentData;
  after?: FirebaseFirestore.DocumentData;
  sourceType: string;
  build: (data: FirebaseFirestore.DocumentData) => Promise<DesiredEntry | null>;
}): Promise<ReconcileAction> {
  const { orgId, sourceRef, before, after, sourceType, build } = opts;
  const db = admin.firestore();
  const journalCol = db.collection(`organizations/${orgId}/journalEntries`);

  // --- Deletion: drop any GL entry the doc produced. ---
  if (!after) {
    const jeId = before?.journalEntryId;
    if (jeId) {
      await journalCol.doc(jeId).delete().catch((e) => {
        logger.warn("[posting] failed to delete JE on source delete", { orgId, jeId, message: e?.message });
      });
      logger.info("[posting] reversed GL entry (source deleted)", { orgId, sourceType, jeId });
      return "deleted";
    }
    return "unchanged";
  }

  // --- Compute desired state and compare to what's already posted. ---
  let desired: DesiredEntry | null = null;
  try {
    desired = await build(after);
  } catch (e: any) {
    logger.error("[posting] build failed — leaving GL untouched", { orgId, sourceType, message: e?.message });
    return "error";
  }
  if (desired) assertBalanced(desired, sourceType);

  const desiredHash = hashEntry(desired);
  const currentHash = (after.glHash as string) || "";
  if (desiredHash === currentHash) return "unchanged"; // converged (incl. our own write-back)

  const existingJeId = after.journalEntryId as string | undefined;

  // Replace strategy: delete the prior entry, then write the fresh one. Auto-posted
  // entries are system-owned, so rewriting (rather than reversing) keeps the GL clean.
  if (existingJeId) {
    await journalCol.doc(existingJeId).delete().catch((e) => {
      logger.warn("[posting] failed to delete stale JE", { orgId, jeId: existingJeId, message: e?.message });
    });
  }

  let newJeId: string | null = null;
  if (desired) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = journalCol.doc();
    await ref.set({
      date: desired.date instanceof Date ? admin.firestore.Timestamp.fromDate(desired.date) : desired.date,
      reference: desired.reference,
      memo: desired.memo,
      lines: desired.lines.map((l) => ({
        accountId: l.accountId,
        accountName: l.accountName || "",
        debit: round2(l.debit || 0),
        credit: round2(l.credit || 0),
        description: l.description || "",
      })),
      status: "posted",
      autoPosted: true,
      source: { type: sourceType, id: sourceRef.id },
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    });
    newJeId = ref.id;
  }

  // Write back managed fields. This re-triggers the function once; next pass the
  // hash matches and we early-return above.
  await sourceRef.update({
    journalEntryId: newJeId ?? admin.firestore.FieldValue.delete(),
    glHash: desiredHash,
  });

  logger.info("[posting] GL reconciled", { orgId, sourceType, sourceId: sourceRef.id, journalEntryId: newJeId, posted: !!desired });
  return desired ? "created" : "deleted";
}
