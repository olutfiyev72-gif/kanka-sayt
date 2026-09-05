// ============================================================
// KANKA — Core TypeScript Types
// ============================================================

export type UserRole = 'OWNER' | 'ADMIN' | 'CLIENT'

// ---------------------------
// Product
// ---------------------------
export interface Product {
  id: string
  sku: string                     // Primary Business Identifier (e.g. RICE-001)
  name?: string | null            // Internal database alias to sku
  slug: string
  description: string | null
  category?: string | null
  image_url: string | null
  gallery_urls: string[]
  weight_per_box: number          // 1 qadoq og'irligi (kg)
  unit_name: string               // Qadoq turi (e.g. 'Qop', 'Karopka')
  cost_price?: number | null      // Private to Owner/Admin, hidden from Client
  selling_price?: number | null   // Computed server-side (cost_price * (1 + markup/100))
  price?: number | null           // Backward compatible alias to selling_price
  total_stock: number             // Qadoqlar soni
  available_stock: number
  reserved_stock: number
  minimum_stock: number          // Minimum required stock threshold
  low_stock_threshold: number    // Backward compatible alias to minimum_stock
  is_active: boolean
  seo_title?: string | null
  seo_description?: string | null
  created_at: string
  updated_at: string
}

// Public-safe product (cost_price, markup and internal margins stripped)
export type PublicProduct = Omit<Product, 'cost_price'>

export type StockStatus = 'available' | 'low' | 'out' | 'GREEN' | 'YELLOW' | 'RED' | 'ORDER_REQUIRED'

export function getStockStatus(product: { available_stock: number; minimum_stock?: number; low_stock_threshold?: number }): 'available' | 'low' | 'out' {
  const minStock = product.minimum_stock ?? product.low_stock_threshold ?? 5
  if (product.available_stock === 0) return 'out'
  if (product.available_stock <= minStock) return 'low'
  return 'available'
}

export function getThresholdStatus(product: { available_stock: number; minimum_stock?: number; low_stock_threshold?: number }): 'GREEN' | 'YELLOW' | 'RED' {
  const minStock = product.minimum_stock ?? product.low_stock_threshold ?? 5
  if (product.available_stock === 0) return 'RED'
  if (product.available_stock <= minStock) return 'YELLOW'
  return 'GREEN'
}


export function isReorderRequired(product: { available_stock: number; minimum_stock?: number; low_stock_threshold?: number }): boolean {
  const minStock = product.minimum_stock ?? product.low_stock_threshold ?? 5
  return product.available_stock <= minStock
}

export function getSuggestedOrder(product: { available_stock: number; minimum_stock?: number; low_stock_threshold?: number }): number {
  const minStock = product.minimum_stock ?? product.low_stock_threshold ?? 5
  return Math.max(0, minStock - product.available_stock)
}

// ---------------------------
// Order
// ---------------------------
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'READY' | 'COMPLETED' | 'CANCELLED'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Yangi',
  CONFIRMED: 'Tasdiqlangan',
  READY: 'Tayyor',
  COMPLETED: 'Berildi',
  CANCELLED: 'Bekor qilindi',
}

// Valid status transitions
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

export interface Order {
  id: string
  order_number: string
  customer_name: string
  phone: string
  visit_time: string | null
  note: string | null
  status: OrderStatus
  total_boxes: number
  total_weight: number
  total_cost?: number
  total_revenue?: number
  total_profit?: number
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name_snapshot: string
  sku_snapshot?: string | null
  weight_per_box_snapshot: number
  quantity_boxes: number
  total_weight: number
  unit_cost_at_sale?: number
  unit_price_at_sale?: number
  total_cost?: number
  total_revenue?: number
  gross_profit?: number
  created_at: string
}

// ---------------------------
// Stock Movement
// ---------------------------
export type StockMovementType =
  | 'INITIAL_STOCK'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'SALE'
  | 'RESERVATION'
  | 'RELEASE_RESERVATION'
  | 'RETURN'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'IN'        // legacy support
  | 'OUT'       // legacy support
  | 'RESERVE'   // legacy support
  | 'RELEASE'   // legacy support

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  INITIAL_STOCK: 'Boshlang\'ich qoldiq',
  STOCK_IN: 'Kirim',
  STOCK_OUT: 'Chiqim',
  SALE: 'Sotuv',
  RESERVATION: 'Rezervatsiya',
  RELEASE_RESERVATION: 'Rezerv qaytarildi',
  RETURN: 'Qaytarib olish',
  DAMAGE: 'Yaroqsiz / Brak',
  ADJUSTMENT: 'Tuzatish (Inventarizatsiya)',
  IN: 'Kirim',
  OUT: 'Chiqim',
  RESERVE: 'Rezerv',
  RELEASE: 'Rezerv qaytarildi',
}

export interface StockMovement {
  id: string
  product_id: string
  movement_type: StockMovementType
  quantity: number
  previous_available: number
  new_available: number
  previous_total: number
  new_total: number
  reason: string | null
  note?: string | null
  actor?: string | null
  order_id: string | null
  admin_user_id: string | null
  created_at: string
  products?: { name: string }
}

// ---------------------------
// Audit Log
// ---------------------------
export type AuditAction =
  | 'product_created'
  | 'product_updated'
  | 'cost_changed'
  | 'stock_added'
  | 'stock_adjusted'
  | 'product_activated'
  | 'product_deactivated'
  | 'settings_updated'
  | 'user_credentials_updated'


export interface AuditLog {
  id: string
  actor: string
  action: AuditAction
  product_id: string | null
  product_name?: string | null
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
  created_at: string
}

// ---------------------------
// Reports Data (Owner Only)
// ---------------------------
export interface FinancialSummary {
  revenue: number
  total_cost: number
  gross_profit: number
  margin_percent: number
  orders_count: number
  units_sold: number
  cancelled_orders: number
}

export interface ProductPerformanceItem {
  id: string
  name: string
  sku: string | null
  current_stock: number
  units_sold: number
  revenue: number
  cost: number
  gross_profit: number
  margin_percent: number
}

export interface ReorderPlanningItem {
  id: string
  name: string
  sku: string | null
  current_stock: number
  reserved_stock: number
  available_stock: number
  minimum_stock: number
  suggested_order: number
  status: 'REORDER_REQUIRED' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'SUFFICIENT'
}

export interface InventoryValuationSummary {
  total_units: number
  available_units: number
  reserved_units: number
  total_valuation_cost: number
  total_valuation_selling: number
  low_stock_count: number
  out_of_stock_count: number
  reorder_required_count: number
}

export interface OwnerReportsData {
  period: string
  summary: FinancialSummary
  products: ProductPerformanceItem[]
  top_by_units: ProductPerformanceItem[]
  top_by_revenue: ProductPerformanceItem[]
  top_by_profit: ProductPerformanceItem[]
  inventory: InventoryValuationSummary
  reorder_planning: ReorderPlanningItem[]
}

// ---------------------------
// App Settings
// ---------------------------
export interface AppSettings {
  company_name: string
  phone: string
  telegram_url: string
  warehouse_address: string
  working_hours: string
  low_stock_default_threshold: string
  markup_percent?: string
  telegram_bot_token?: string
  telegram_chat_id?: string
}

// ---------------------------
// Cart / Order Store
// ---------------------------
export interface CartItem {
  productId: string
  sku: string
  productName?: string
  unitName?: string
  quantity: number
  weightPerBox: number
  availableStock: number
  imageUrl: string | null
  sellingPrice?: number | null
}

// ---------------------------
// API Response
// ---------------------------
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  code?: string
}

export interface CreateOrderPayload {
  customer_name: string
  phone: string
  visit_time?: string | null
  note?: string | null
  items: {
    product_id: string
    quantity_boxes: number
  }[]
}

export interface CreateOrderResult {
  success: boolean
  order_id: string
  order_number: string
  total_boxes: number
  total_weight: number
  total_cost?: number
  total_revenue?: number
  total_profit?: number
}
