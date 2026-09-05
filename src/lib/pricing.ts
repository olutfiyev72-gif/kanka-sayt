/**
 * KANKA — Pricing & Valuation Engine
 * Handles automatic markup, UZS integer currency rounding, profit snapshots, and reorder planning formulas.
 */

export const DEFAULT_MARKUP_PERCENT = 15

/**
 * Calculates selling price with markup percentage and rounds to nearest integer (UZS currency).
 * E.g.
 * 100000 -> 115000 (15% markup)
 * 200000 -> 230000
 * 50000  -> 57500
 */
export function calculateSellingPrice(costPrice: number | null | undefined, markupPercent: number = DEFAULT_MARKUP_PERCENT): number {
  if (!costPrice || costPrice <= 0) return 0
  const factor = 1 + markupPercent / 100
  // Round to nearest integer to avoid any floating point precision issues in UZS
  return Math.round(costPrice * factor)
}

/**
 * Calculates gross profit and margin percent
 */
export function calculateProfit(
  sellingPrice: number,
  costPrice: number,
  quantity: number = 1
): {
  revenue: number
  totalCost: number
  grossProfit: number
  marginPercent: number
} {
  const safeQty = Math.max(0, quantity)
  const safeSell = Math.max(0, sellingPrice)
  const safeCost = Math.max(0, costPrice)

  const revenue = safeSell * safeQty
  const totalCost = safeCost * safeQty
  const grossProfit = revenue - totalCost
  const marginPercent = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(2)) : 0

  return {
    revenue,
    totalCost,
    grossProfit,
    marginPercent,
  }
}

export interface ReorderRecommendation {
  suggestedOrder: number
  reorderRequired: boolean
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'SUFFICIENT'
  color: 'red' | 'yellow' | 'green'
}

/**
 * Calculates suggested reorder quantity: max(0, minimum_stock - available_stock)
 */
export function calculateSuggestedOrder(availableStock: number, minimumStock: number): number {
  return Math.max(0, minimumStock - availableStock)
}

/**
 * Get comprehensive reorder recommendation with status and threshold color
 */
export function getReorderRecommendation(availableStock: number, minimumStock: number): ReorderRecommendation {
  const suggestedOrder = calculateSuggestedOrder(availableStock, minimumStock)
  let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'SUFFICIENT' = 'SUFFICIENT'
  let color: 'red' | 'yellow' | 'green' = 'green'

  if (availableStock <= 0) {
    status = 'OUT_OF_STOCK'
    color = 'red'
  } else if (availableStock <= minimumStock) {
    status = 'LOW_STOCK'
    color = 'yellow'
  }

  return {
    suggestedOrder,
    reorderRequired: suggestedOrder > 0,
    status,
    color,
  }
}


/**
 * Format UZS currency for display
 */
export function formatUZS(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 UZS'
  return `${Math.round(amount).toLocaleString('uz-UZ')} UZS`
}
