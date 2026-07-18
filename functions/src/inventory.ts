// Perpetual weighted-average inventory engine.
//
// The GL posting engine (posting.ts) is per-document and idempotent, so it cannot by
// itself compute a running average cost that depends on the order of every purchase and
// sale. This module fills that gap: on any change to a stock-affecting document it
// **replays all inventory movements in date order**, maintains each item's
// quantity-on-hand and weighted-average cost, and **stamps the computed cost of goods
// sold back onto each sale line** (`line.cost`). Stamping re-triggers that invoice's
// posting, which then adds the COGS legs — after which the normal hash-idempotency holds.
//
// Scope (v1): stock IN via bills, stock OUT (with COGS) via invoices. Sales/purchase
// returns (credit/debit notes) do not yet move stock — a documented follow-up.

import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { round2 } from "./posting";
import { ensureInventoryAccountTags } from "./backfill";

const POSTED_SALE = (status: string) => status !== "draft" && status !== "void";

interface Movement {
  itemId: string;
  dateMs: number;
  order: number; // 0 = in (purchase), 1 = out (sale) — purchases settle first same-day
  createdMs: number;
  docId: string;
  lineIndex: number;
  type: "in" | "out";
  qty: number;
  unitCost: number; // purchases only
}

function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return 0;
}

/**
 * Replay every stock movement for an org in chronological order, updating each
 * inventory item's qtyOnHand/avgCost/stockValue and stamping COGS onto sale lines.
 * Idempotent: only writes documents whose derived values actually changed, so repeated
 * runs converge and don't loop.
 */
export async function recomputeInventory(orgId: string): Promise<void> {
  const db = admin.firestore();

  // Legacy charts may predate the inventory/COGS system tags.
  await ensureInventoryAccountTags(orgId);

  const itemsSnap = await db.collection(`organizations/${orgId}/items`).get();
  const inventoryItemIds = new Set<string>();
  for (const d of itemsSnap.docs) {
    if (d.data().kind === "inventory") inventoryItemIds.add(d.id);
  }
  if (inventoryItemIds.size === 0) return; // nothing tracked

  const [billsSnap, invoicesSnap] = await Promise.all([
    db.collection(`organizations/${orgId}/purchaseInvoices`).get(),
    db.collection(`organizations/${orgId}/salesInvoices`).get(),
  ]);

  const movements: Movement[] = [];

  for (const doc of billsSnap.docs) {
    const b = doc.data();
    if (!POSTED_SALE(b.status)) continue;
    (b.lines || []).forEach((line: any, i: number) => {
      if (inventoryItemIds.has(line.itemId) && (line.quantity || 0) > 0) {
        movements.push({
          itemId: line.itemId, dateMs: toMs(b.date), order: 0, createdMs: toMs(b.createdAt),
          docId: doc.id, lineIndex: i, type: "in",
          qty: line.quantity, unitCost: line.unitPrice || 0,
        });
      }
    });
  }

  // Keep invoice docs for the cost write-back pass.
  const invoiceDocs = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  for (const doc of invoicesSnap.docs) {
    const inv = doc.data();
    if (!POSTED_SALE(inv.status)) continue;
    invoiceDocs.set(doc.id, doc);
    (inv.lines || []).forEach((line: any, i: number) => {
      if (inventoryItemIds.has(line.itemId) && (line.quantity || 0) > 0) {
        movements.push({
          itemId: line.itemId, dateMs: toMs(inv.date), order: 1, createdMs: toMs(inv.createdAt),
          docId: doc.id, lineIndex: i, type: "out",
          qty: line.quantity, unitCost: 0,
        });
      }
    });
  }

  movements.sort((a, b) =>
    a.dateMs - b.dateMs || a.order - b.order || a.createdMs - b.createdMs ||
    a.docId.localeCompare(b.docId) || a.lineIndex - b.lineIndex
  );

  // Replay.
  const state = new Map<string, { qty: number; avgCost: number }>();
  const stamps = new Map<string, Map<number, number>>(); // invoiceId -> lineIndex -> cost
  for (const m of movements) {
    const s = state.get(m.itemId) || { qty: 0, avgCost: 0 };
    if (m.type === "in") {
      const totalCost = s.qty * s.avgCost + m.qty * m.unitCost;
      s.qty += m.qty;
      s.avgCost = s.qty > 0 ? totalCost / s.qty : m.unitCost;
    } else {
      const lineCost = round2(m.qty * s.avgCost);
      s.qty -= m.qty; // average cost unchanged by a sale
      if (!stamps.has(m.docId)) stamps.set(m.docId, new Map());
      stamps.get(m.docId)!.set(m.lineIndex, lineCost);
    }
    state.set(m.itemId, s);
  }

  // Collect writes, then commit in chunks (batch limit is 500).
  const writes: Array<{ ref: admin.firestore.DocumentReference; data: any }> = [];

  // Item stock fields — only when changed.
  for (const doc of itemsSnap.docs) {
    if (doc.data().kind !== "inventory") continue;
    const s = state.get(doc.id) || { qty: 0, avgCost: 0 };
    const qtyOnHand = round2(s.qty);
    const avgCost = round2(s.avgCost);
    const stockValue = round2(qtyOnHand * avgCost);
    const cur = doc.data();
    if (round2(cur.qtyOnHand || 0) !== qtyOnHand ||
        round2(cur.avgCost || 0) !== avgCost ||
        round2(cur.stockValue || 0) !== stockValue) {
      writes.push({ ref: doc.ref, data: { qtyOnHand, avgCost, stockValue, updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
    }
  }

  // Sale line costs — only when changed. Also zero out any stale cost on lines no longer
  // stamped (e.g. an item was removed from a line).
  for (const [invId, doc] of invoiceDocs) {
    const inv = doc.data();
    const lineStamps = stamps.get(invId) || new Map<number, number>();
    let changed = false;
    const newLines = (inv.lines || []).map((line: any, i: number) => {
      const desired = lineStamps.has(i) ? lineStamps.get(i)! : (line.itemId ? 0 : undefined);
      if (desired === undefined) return line;
      if (round2(line.cost || 0) !== desired) { changed = true; return { ...line, cost: desired }; }
      return line;
    });
    if (changed) {
      writes.push({ ref: doc.ref, data: { lines: newLines, updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
    }
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) batch.set(w.ref, w.data, { merge: true });
    await batch.commit();
  }

  logger.info("[inventory] recompute complete", { orgId, items: inventoryItemIds.size, movements: movements.length, writes: writes.length });
}

/**
 * Run `recomputeInventory` behind a per-org debounce lock so bursts of writes collapse
 * into a single ordered pass and concurrent triggers never overlap.
 */
async function runLockedRecompute(orgId: string): Promise<void> {
  const db = admin.firestore();
  const lockRef = db.doc(`organizations/${orgId}/system/inventoryLock`);

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    if (snap.exists && snap.data()?.running) {
      tx.set(lockRef, { dirty: true }, { merge: true });
      return false;
    }
    tx.set(lockRef, { running: true, dirty: false }, { merge: true });
    return true;
  });
  if (!claimed) return;

  try {
    // Loop while new writes arrived during a pass (dirty), then release.
    // Bounded to avoid a pathological infinite loop.
    for (let pass = 0; pass < 10; pass++) {
      await recomputeInventory(orgId);
      const again = await db.runTransaction(async (tx) => {
        const snap = await tx.get(lockRef);
        if (snap.data()?.dirty) { tx.set(lockRef, { dirty: false }, { merge: true }); return true; }
        tx.set(lockRef, { running: false }, { merge: true });
        return false;
      });
      if (!again) return;
    }
    await lockRef.set({ running: false }, { merge: true });
  } catch (e: any) {
    logger.error("[inventory] recompute failed — releasing lock", { orgId, message: e?.message });
    await lockRef.set({ running: false }, { merge: true }).catch(() => {});
    throw e;
  }
}

// Triggers: any change to a stock-affecting subledger doc kicks off a recompute.
export const onInvoiceInventoryWritten = onDocumentWritten(
  "organizations/{orgId}/salesInvoices/{invoiceId}",
  async (event) => { await runLockedRecompute(event.params.orgId); }
);

export const onBillInventoryWritten = onDocumentWritten(
  "organizations/{orgId}/purchaseInvoices/{billId}",
  async (event) => { await runLockedRecompute(event.params.orgId); }
);

// Manual "Recalculate stock" — authoritative correction after backdated/edited docs.
export const recalcInventory = onCall(
  { timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const orgId = request.data?.orgId as string;
    if (!orgId) throw new HttpsError("invalid-argument", "orgId is required.");

    const db = admin.firestore();
    const memberSnap = await db.doc(`organizations/${orgId}/members/${uid}`).get();
    if (!memberSnap.exists) throw new HttpsError("permission-denied", "Not a member of this organization.");

    await runLockedRecompute(orgId);
    return { success: true, orgId };
  }
);
