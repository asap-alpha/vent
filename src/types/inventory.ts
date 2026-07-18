/**
 * A catalog item — either a stock-tracked `inventory` product or a `service`
 * (non-inventory) line template. Items pre-fill invoice/bill lines; inventory items
 * additionally drive perpetual weighted-average stock tracking and COGS posting.
 *
 * Collection: `organizations/{orgId}/items`
 */
export type ItemKind = 'inventory' | 'service'

export interface Item {
  id: string
  name: string
  sku: string
  description: string
  kind: ItemKind
  /** Default unit price on invoices. */
  salesPrice: number
  /** Revenue account sales of this item post to. */
  incomeAccountId: string
  /** Default unit cost on bills. */
  purchasePrice: number
  /** Service items only — expense account bills post to. */
  expenseAccountId?: string
  /** Inventory items — asset account stock is held in (defaults to the `inventory` system account). */
  inventoryAccountId?: string
  /** Inventory items — cost-of-goods-sold account (defaults to the `cogs` system account). */
  cogsAccountId?: string
  /** Default tax code applied when the item is added to a line. */
  defaultTaxCodeId?: string
  /** Unit of measure label, e.g. 'each', 'hour'. */
  unit: string
  isActive: boolean

  // --- Server-maintained by the inventory recompute engine. Clients never write these. ---
  /** Quantity currently on hand (inventory items). */
  qtyOnHand: number
  /** Weighted-average unit cost (inventory items). */
  avgCost: number
  /** qtyOnHand * avgCost. */
  stockValue: number

  createdAt: Date
  updatedAt: Date
}
