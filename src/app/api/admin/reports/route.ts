import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/adminAuth'
import { calculateSellingPrice, calculateSuggestedOrder } from '@/lib/pricing'
import type { OwnerReportsData, ProductPerformanceItem, ReorderPlanningItem } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // 1. Authorization: strictly enforce OWNER role
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Avtorizatsiyadan o\'tilmagan' }, { status: 401 })
    }

    const session = await verifySessionToken(sessionToken)
    if (!session || session.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Ruxsat yo\'q: Ushbu moliyaviy ma\'lumotlar faqat do\'kon egasi (OWNER) uchun ochiq.' },
        { status: 403 }
      )
    }

    // 2. Parse query filters
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const customFrom = searchParams.get('from')
    const customTo = searchParams.get('to')

    const now = new Date()
    let startDate = new Date()
    let endDate = new Date()

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
    } else if (period === 'yesterday') {
      startDate.setDate(now.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)
      endDate.setDate(now.getDate() - 1)
      endDate.setHours(23, 59, 59, 999)
    } else if (period === 'week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
      startDate.setDate(diff)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (period === 'custom' && customFrom && customTo) {
      startDate = new Date(customFrom)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(customTo)
      endDate.setHours(23, 59, 59, 999)
    } else {
      // Default all time / today
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
    }

    const supabase = createAdminClient()

    // 3. Fetch products
    const { data: rawProducts } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true })

    const products = rawProducts || []

    // 4. Fetch orders within period
    const { data: rawOrders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    const orders = rawOrders || []

    // 5. Aggregate Sales & Profits
    let totalRevenue = 0
    let totalCost = 0
    let unitsSold = 0
    let cancelledOrders = 0

    const productStatsMap = new Map<
      string,
      {
        name: string
        sku: string | null
        units_sold: number
        revenue: number
        cost: number
        current_stock: number
      }
    >()

    // Initialize map with all products
    products.forEach((p) => {
      productStatsMap.set(p.id, {
        name: p.name,
        sku: p.sku || null,
        units_sold: 0,
        revenue: 0,
        cost: 0,
        current_stock: p.available_stock || 0,
      })
    })

    orders.forEach((order) => {
      if (order.status === 'CANCELLED') {
        cancelledOrders++
        return
      }

      const items = order.order_items || []
      items.forEach((item: { quantity_boxes?: number; unit_cost_at_sale?: number | null; unit_price_at_sale?: number | null; total_revenue?: number | null; total_cost?: number | null; product_id?: string }) => {
        const qty = item.quantity_boxes || 0
        const itemCost =
          item.unit_cost_at_sale ??
          (item.product_id ? (products.find((p) => p.id === item.product_id)?.cost_price || 0) : 0)
        const matchedProduct = item.product_id ? products.find((p) => p.id === item.product_id) : null
        const itemPrice =
          item.unit_price_at_sale ??
          (matchedProduct ? (matchedProduct.selling_price ?? matchedProduct.price ?? 0) : 0)

        const rev = item.total_revenue ?? (itemPrice * qty)
        const cost = item.total_cost ?? (itemCost * qty)

        totalRevenue += rev
        totalCost += cost
        unitsSold += qty

        if (item.product_id && productStatsMap.has(item.product_id)) {
          const stat = productStatsMap.get(item.product_id)!
          stat.units_sold += qty
          stat.revenue += rev
          stat.cost += cost
        }
      })
    })

    const grossProfit = totalRevenue - totalCost
    const marginPercent = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0

    // 6. Build product performance array
    const productPerformance: ProductPerformanceItem[] = Array.from(productStatsMap.entries()).map(
      ([id, stat]) => {
        const profit = stat.revenue - stat.cost
        const margin = stat.revenue > 0 ? Number(((profit / stat.revenue) * 100).toFixed(2)) : 0
        return {
          id,
          name: stat.name,
          sku: stat.sku,
          current_stock: stat.current_stock,
          units_sold: stat.units_sold,
          revenue: stat.revenue,
          cost: stat.cost,
          gross_profit: profit,
          margin_percent: margin,
        }
      }
    )

    // Top products ranking
    const topByUnits = [...productPerformance].sort((a, b) => b.units_sold - a.units_sold).slice(0, 5)
    const topByRevenue = [...productPerformance].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    const topByProfit = [...productPerformance].sort((a, b) => b.gross_profit - a.gross_profit).slice(0, 5)

    // 7. Inventory Valuation & Reorder Planning ("Ertangi kun uchun")
    let totalStockUnits = 0
    let totalAvailableUnits = 0
    let totalReservedUnits = 0
    let totalValuationCost = 0
    let totalValuationSelling = 0
    let lowStockCount = 0
    let outOfStockCount = 0
    let reorderRequiredCount = 0

    const reorderPlanning: ReorderPlanningItem[] = products.map((p) => {
      const available = p.available_stock || 0
      const reserved = p.reserved_stock || 0
      const total = p.total_stock || (available + reserved)
      const minStock = p.minimum_stock ?? p.low_stock_threshold ?? 5
      const cost = p.cost_price || 0
      const selling = p.selling_price || calculateSellingPrice(cost)

      totalStockUnits += total
      totalAvailableUnits += available
      totalReservedUnits += reserved
      totalValuationCost += total * cost
      totalValuationSelling += total * selling

      const suggested = calculateSuggestedOrder(available, minStock)

      let status: ReorderPlanningItem['status'] = 'SUFFICIENT'
      if (available === 0) {
        status = 'OUT_OF_STOCK'
        outOfStockCount++
        reorderRequiredCount++
      } else if (available <= minStock) {
        status = 'LOW_STOCK'
        lowStockCount++
        reorderRequiredCount++
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku || null,
        current_stock: total,
        reserved_stock: reserved,
        available_stock: available,
        minimum_stock: minStock,
        suggested_order: suggested,
        status,
      }
    })

    const responseData: OwnerReportsData = {
      period,
      summary: {
        revenue: totalRevenue,
        total_cost: totalCost,
        gross_profit: grossProfit,
        margin_percent: marginPercent,
        orders_count: orders.length,
        units_sold: unitsSold,
        cancelled_orders: cancelledOrders,
      },
      products: productPerformance,
      top_by_units: topByUnits,
      top_by_revenue: topByRevenue,
      top_by_profit: topByProfit,
      inventory: {
        total_units: totalStockUnits,
        available_units: totalAvailableUnits,
        reserved_units: totalReservedUnits,
        total_valuation_cost: totalValuationCost,
        total_valuation_selling: totalValuationSelling,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        reorder_required_count: reorderRequiredCount,
      },
      reorder_planning: reorderPlanning,
    }

    return NextResponse.json({ data: responseData })
  } catch (err) {
    console.error('[GET /api/admin/reports]', err)
    return NextResponse.json({ error: 'Hisobotlarni yuklab bo\'lmadi' }, { status: 500 })
  }
}
