export type DiscountStatus = 'active' | 'used' | 'revoked'

/**
 * Per-organization single-use subscription discount. Created by a super admin,
 * stored in the top-level `discounts` collection, validated + applied server-side
 * (Cheqam backend) at subscribe time, and marked `used` once payment is confirmed.
 */
export interface Discount {
  id: string
  code: string
  orgId: string
  discountPercent: number
  status: DiscountStatus
  expiresAt: Date | null
  createdAt: Date | null
  createdBy: string
  notes: string
  usedAt: Date | null
  usedOnClientReference: string
  usedOnPlanId: string
}
