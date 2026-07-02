// Standard Ghana tax codes seeded for every new organization. Mirrors the client-side
// defaults in src/stores/tax.ts. Components reference the levy liability accounts by the
// chart code, resolved at seed time.

import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

interface SeedComponent {
  name: string;
  rate: number;
  accountCode: string; // resolved to accountId at seed time
  compound: boolean;
}

interface SeedTaxCode {
  name: string;
  components: SeedComponent[];
}

const DEFAULT_TAX_CODES: SeedTaxCode[] = [
  { name: "No Tax", components: [] },
  {
    name: "VAT 15%",
    components: [{ name: "VAT", rate: 15, accountCode: "2100", compound: false }],
  },
  {
    name: "Standard Rate (VAT + Levies)",
    components: [
      { name: "NHIL", rate: 2.5, accountCode: "2110", compound: false },
      { name: "GETFund", rate: 2.5, accountCode: "2120", compound: false },
      { name: "COVID-19 Levy", rate: 1, accountCode: "2130", compound: false },
      { name: "VAT", rate: 15, accountCode: "2100", compound: true },
    ],
  },
];

/** Effective total rate a code applies to a base of 100 (mirrors utils/tax.effectiveTaxRate). */
function effectiveRate(components: Array<{ rate: number; compound: boolean }>): number {
  let running = 100;
  let total = 0;
  for (const c of components) {
    const taxable = c.compound ? running : 100;
    const amt = Math.round((taxable * (c.rate / 100) + Number.EPSILON) * 100) / 100;
    running = Math.round((running + amt + Number.EPSILON) * 100) / 100;
    total = Math.round((total + amt + Number.EPSILON) * 100) / 100;
  }
  return total;
}

/**
 * Seed default tax codes for an org that has none. Resolves component accounts from the
 * chart by code; the VAT account (2100) is required, levy accounts fall back to it if
 * absent. Idempotent. Returns the number of codes created.
 */
export async function seedTaxCodesFor(orgId: string): Promise<number> {
  const db = admin.firestore();
  const col = db.collection(`organizations/${orgId}/taxCodes`);
  const existing = await col.limit(1).get();
  if (!existing.empty) {
    logger.info("[seedTaxCodes] org already has tax codes — skipping", { orgId });
    return 0;
  }

  // Build code → accountId map from the chart.
  const accountsSnap = await db.collection(`organizations/${orgId}/accounts`).get();
  const idByCode = new Map<string, string>();
  accountsSnap.forEach((d) => {
    const code = d.data()?.code;
    if (code) idByCode.set(String(code), d.id);
  });
  const vatId = idByCode.get("2100");
  if (!vatId) {
    logger.warn("[seedTaxCodes] no VAT account (2100) — skipping", { orgId });
    return 0;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  for (const code of DEFAULT_TAX_CODES) {
    const components = code.components.map((c) => ({
      name: c.name,
      rate: c.rate,
      accountId: idByCode.get(c.accountCode) || vatId,
      compound: c.compound,
    }));
    batch.set(col.doc(), {
      name: code.name,
      rate: effectiveRate(code.components),
      components,
      isActive: true,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  logger.info("[seedTaxCodes] seeded default tax codes", { orgId, count: DEFAULT_TAX_CODES.length });
  return DEFAULT_TAX_CODES.length;
}
