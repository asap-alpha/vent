// Standard default chart of accounts seeded for every new organization. Modeled on
// Manager.io / Xero starter charts. `systemType` tags the control accounts the
// posting engine resolves by role (AR, AP, tax, retained earnings, etc.).
// Codes follow the classic banding: 1xxx assets, 2xxx liabilities, 3xxx equity,
// 4xxx income, 5xxx cost of sales, 6xxx expenses.
//
// `subtype` is the second-level classification the Balance Sheet and P&L group by:
// current vs fixed assets, current vs long-term liabilities, and cost of sales vs
// operating expenses. Keep this in sync with src/types/accounting.ts and the client-side
// fallback chart in src/stores/accounts.ts.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type AccountSubtype =
  | "current_asset"
  | "fixed_asset"
  | "current_liability"
  | "long_term_liability"
  | "cost_of_sales"
  | "operating_expense";

export type SystemAccountType =
  | "accounts_receivable"
  | "accounts_payable"
  | "tax_payable"
  | "retained_earnings"
  | "opening_balance_equity"
  | "sales"
  | "purchases"
  | "bank"
  | "exchange_gain_loss"
  | "inventory"
  | "cogs";

export interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  subtype?: AccountSubtype;
  systemType?: SystemAccountType;
  description?: string;
}

export const DEFAULT_CHART: SeedAccount[] = [
  // ---- Current assets ----
  { code: "1000", name: "Cash on Hand", type: "asset", subtype: "current_asset" },
  { code: "1010", name: "Bank Account", type: "asset", subtype: "current_asset", systemType: "bank" },
  { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "current_asset", systemType: "accounts_receivable",
    description: "Money owed to you by customers (control account)." },
  { code: "1200", name: "Inventory", type: "asset", subtype: "current_asset", systemType: "inventory",
    description: "Stock held for resale (control account for perpetual inventory)." },
  { code: "1300", name: "Prepayments", type: "asset", subtype: "current_asset",
    description: "Expenses paid in advance of the period they relate to." },

  // ---- Fixed assets ----
  { code: "1400", name: "Land", type: "asset", subtype: "fixed_asset" },
  { code: "1410", name: "Buildings", type: "asset", subtype: "fixed_asset" },
  { code: "1420", name: "Equipment", type: "asset", subtype: "fixed_asset" },
  { code: "1430", name: "Motor Vehicles", type: "asset", subtype: "fixed_asset" },
  { code: "1440", name: "Furniture & Fittings", type: "asset", subtype: "fixed_asset" },
  { code: "1450", name: "Accumulated Depreciation", type: "asset", subtype: "fixed_asset",
    description: "Contra-asset; carries a credit balance." },

  // ---- Current liabilities ----
  { code: "2000", name: "Accounts Payable", type: "liability", subtype: "current_liability", systemType: "accounts_payable",
    description: "Money you owe suppliers (control account)." },
  { code: "2100", name: "VAT Payable", type: "liability", subtype: "current_liability", systemType: "tax_payable",
    description: "VAT collected on sales, net of VAT on purchases (control account)." },
  { code: "2110", name: "NHIL Payable", type: "liability", subtype: "current_liability",
    description: "National Health Insurance Levy collected on sales." },
  { code: "2120", name: "GETFund Levy Payable", type: "liability", subtype: "current_liability",
    description: "Ghana Education Trust Fund levy collected on sales." },
  { code: "2130", name: "COVID-19 Levy Payable", type: "liability", subtype: "current_liability",
    description: "COVID-19 Health Recovery Levy collected on sales." },
  { code: "2200", name: "Accrued Liabilities", type: "liability", subtype: "current_liability" },
  { code: "2300", name: "Short-Term Loans", type: "liability", subtype: "current_liability",
    description: "Borrowings repayable within twelve months." },

  // ---- Long-term liabilities ----
  { code: "2700", name: "Long-Term Loans", type: "liability", subtype: "long_term_liability",
    description: "Borrowings repayable after more than twelve months." },

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
  { code: "5000", name: "Cost of Goods Sold", type: "expense", subtype: "cost_of_sales", systemType: "cogs",
    description: "Cost of inventory sold, posted automatically at weighted-average cost." },
  { code: "5100", name: "Freight & Haulage", type: "expense", subtype: "cost_of_sales",
    description: "Inward carriage and delivery costs attributable to goods sold." },
  { code: "5200", name: "Direct Labour", type: "expense", subtype: "cost_of_sales" },

  // ---- Operating expenses ----
  { code: "6000", name: "General Expenses", type: "expense", subtype: "operating_expense", systemType: "purchases",
    description: "Default expense account for bill lines." },
  { code: "6100", name: "Rent", type: "expense", subtype: "operating_expense" },
  { code: "6200", name: "Utilities", type: "expense", subtype: "operating_expense" },
  { code: "6300", name: "Salaries & Wages", type: "expense", subtype: "operating_expense" },
  { code: "6400", name: "Bank Charges", type: "expense", subtype: "operating_expense" },
  { code: "6500", name: "Office Supplies", type: "expense", subtype: "operating_expense" },
];
