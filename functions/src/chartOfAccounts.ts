// Standard default chart of accounts seeded for every new organization. Modeled on
// Manager.io / Xero starter charts. `systemType` tags the control accounts the
// posting engine resolves by role (AR, AP, tax, retained earnings, etc.).
// Codes follow the classic banding: 1xxx assets, 2xxx liabilities, 3xxx equity,
// 4xxx income, 5xxx cost of sales, 6xxx expenses.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type SystemAccountType =
  | "accounts_receivable"
  | "accounts_payable"
  | "tax_payable"
  | "retained_earnings"
  | "opening_balance_equity"
  | "sales"
  | "purchases"
  | "bank"
  | "exchange_gain_loss";

export interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  systemType?: SystemAccountType;
  description?: string;
}

export const DEFAULT_CHART: SeedAccount[] = [
  // ---- Assets ----
  { code: "1000", name: "Cash on Hand", type: "asset" },
  { code: "1010", name: "Bank Account", type: "asset", systemType: "bank" },
  { code: "1100", name: "Accounts Receivable", type: "asset", systemType: "accounts_receivable",
    description: "Money owed to you by customers (control account)." },
  { code: "1200", name: "Inventory", type: "asset" },
  { code: "1400", name: "Fixed Assets", type: "asset" },
  { code: "1450", name: "Accumulated Depreciation", type: "asset",
    description: "Contra-asset; carries a credit balance." },

  // ---- Liabilities ----
  { code: "2000", name: "Accounts Payable", type: "liability", systemType: "accounts_payable",
    description: "Money you owe suppliers (control account)." },
  { code: "2100", name: "VAT Payable", type: "liability", systemType: "tax_payable",
    description: "VAT collected on sales, net of VAT on purchases (control account)." },
  { code: "2110", name: "NHIL Payable", type: "liability",
    description: "National Health Insurance Levy collected on sales." },
  { code: "2120", name: "GETFund Levy Payable", type: "liability",
    description: "Ghana Education Trust Fund levy collected on sales." },
  { code: "2130", name: "COVID-19 Levy Payable", type: "liability",
    description: "COVID-19 Health Recovery Levy collected on sales." },
  { code: "2200", name: "Accrued Liabilities", type: "liability" },

  // ---- Equity ----
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "3100", name: "Retained Earnings", type: "equity", systemType: "retained_earnings",
    description: "Accumulated prior-year profits." },
  { code: "3200", name: "Opening Balance Equity", type: "equity", systemType: "opening_balance_equity",
    description: "Offsetting account for opening balances during setup." },

  // ---- Income ----
  { code: "4000", name: "Sales Revenue", type: "revenue", systemType: "sales",
    description: "Default income account for invoice lines." },
  { code: "4100", name: "Other Income", type: "revenue" },
  { code: "4900", name: "Exchange Gain/Loss", type: "revenue", systemType: "exchange_gain_loss" },

  // ---- Cost of sales ----
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },

  // ---- Expenses ----
  { code: "6000", name: "General Expenses", type: "expense", systemType: "purchases",
    description: "Default expense account for bill lines." },
  { code: "6100", name: "Rent", type: "expense" },
  { code: "6200", name: "Utilities", type: "expense" },
  { code: "6300", name: "Salaries & Wages", type: "expense" },
  { code: "6400", name: "Bank Charges", type: "expense" },
  { code: "6500", name: "Office Supplies", type: "expense" },
];
