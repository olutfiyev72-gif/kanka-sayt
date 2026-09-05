import Link from 'next/link'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/adminAuth'
import {
  ShoppingCart,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Shield,
  Plus,
  Package,
  Boxes,
} from 'lucide-react'
import { formatUZS } from '@/lib/pricing'
import { formatDate, formatPhone } from '@/lib/validations'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Order, Product } from '@/types'

export const dynamic = 'force-dynamic'

async function getDashboardData(isOwner: boolean) {
  try {
    const supabase = createAdminClient()
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

    const [
      { data: products },
      { data: newOrders },
      { data: todayOrders },
      { data: stockStats },
      { data: recentOrders },
    ] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('orders').select('id').eq('status', 'NEW'),
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .gte('created_at', todayStart),
      supabase
        .from('products')
        .select('available_stock, reserved_stock')
        .eq('is_active', true),
      supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const totalAvailable = stockStats?.reduce((s, p) => s + (p.available_stock || 0), 0) || 0
    const totalReserved = stockStats?.reduce((s, p) => s + (p.reserved_stock || 0), 0) || 0
    const activeProducts = products?.filter((p) => p.is_active).length || 0
    
    // Low stock and out of stock items
    const lowStockItems: Product[] = []
    const outOfStockItems: Product[] = []

    products?.forEach((p: Product) => {
      if (!p.is_active) return
      const min = p.minimum_stock ?? p.low_stock_threshold ?? 5
      if (p.available_stock === 0) {
        outOfStockItems.push(p)
      } else if (p.available_stock <= min) {
        lowStockItems.push(p)
      }
    })

    let todayRevenue = 0
    let todayCost = 0
    let todayUnitsSold = 0

    if (isOwner && todayOrders) {
      todayOrders.forEach((order) => {
        if (order.status === 'CANCELLED') return
        const items = order.order_items || []
        items.forEach((item: { quantity_boxes?: number; unit_cost_at_sale?: number | null; unit_price_at_sale?: number | null; total_revenue?: number | null; total_cost?: number | null; product_id?: string }) => {
          const qty = item.quantity_boxes || 0
          const itemCost =
            item.unit_cost_at_sale ??
            (products?.find((p) => p.id === item.product_id)?.cost_price || 0)
          const itemPrice =
            item.unit_price_at_sale ??
            (products?.find((p) => p.id === item.product_id)?.selling_price ||
              products?.find((p) => p.id === item.product_id)?.price ||
              0)
          todayRevenue += item.total_revenue ?? itemPrice * qty
          todayCost += item.total_cost ?? itemCost * qty
          todayUnitsSold += qty
        })
      })
    }

    const todayGrossProfit = todayRevenue - todayCost
    const todayMargin = todayRevenue > 0 ? ((todayGrossProfit / todayRevenue) * 100).toFixed(1) : '0'

    return {
      totalProducts: products?.length || 0,
      activeProducts,
      totalAvailable,
      totalReserved,
      newOrdersCount: newOrders?.length || 0,
      todayOrdersCount: todayOrders?.length || 0,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      todayRevenue,
      todayGrossProfit,
      todayMargin,
      todayUnitsSold,
      recentOrders: (recentOrders as Order[]) || [],
      alertItems: [...outOfStockItems, ...lowStockItems].slice(0, 5),
    }
  } catch {
    return {
      totalProducts: 0,
      activeProducts: 0,
      totalAvailable: 0,
      totalReserved: 0,
      newOrdersCount: 0,
      todayOrdersCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      todayRevenue: 0,
      todayGrossProfit: 0,
      todayMargin: '0',
      todayUnitsSold: 0,
      recentOrders: [],
      alertItems: [],
    }
  }
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  const session = token ? await verifySessionToken(token) : null
  const isOwner = session?.role === 'OWNER'

  const stats = await getDashboardData(isOwner)

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* ===== HEADER & QUICK ACTIONS ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isOwner ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-olive-100 text-olive-900 border border-olive-300">
                <ShieldCheck size={13} className="text-olive" />
                <span>SUPER ADMIN (EGA)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                <Shield size={13} className="text-amber-700" />
                <span>ADMIN (XODIM)</span>
              </span>
            )}
            <span className="text-xs text-muted">· Boshqaruv Markazi</span>
          </div>
          <h1 className="text-2xl font-black text-charcoal tracking-tight">
            {isOwner ? 'Biznes va Ombor Boshqaruvi' : 'Ombor Operatsiyalari'}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {isOwner
              ? 'Daromad, foyda marjasi, yangi buyurtmalar va zaxira holati'
              : 'Ombordagi tovarlar, qoldiqlar va yangi tushgan buyurtmalar'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products/new"
            className="btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-xs"
            title="Yangi mahsulot yaratish"
          >
            <Plus size={15} />
            <span>Mahsulot</span>
          </Link>
          <Link
            href="/admin/stock"
            className="btn-secondary inline-flex items-center gap-1.5 text-xs py-2 px-3 shadow-xs"
            title="Ombor harakati kiritish"
          >
            <Boxes size={14} />
            <span>Ombor</span>
          </Link>
          {isOwner && (
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-olive bg-olive-50 hover:bg-olive-100 border border-olive-200 px-3 py-2 rounded-xl transition-colors"
            >
              <TrendingUp size={14} />
              <span>Moliya</span>
            </Link>
          )}
        </div>
      </div>

      {/* ===== COMPACT KPI GRID ===== */}
      {isOwner ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {/* 1. Savdo */}
          <div className="card p-3 bg-gradient-to-br from-white to-olive-50/40 border border-olive-200/80 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Bugungi Savdo</span>
              <DollarSign size={14} className="text-olive flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-charcoal truncate">{formatUZS(stats.todayRevenue)}</p>
            <p className="text-[10px] text-olive font-medium mt-0.5 truncate">{stats.todayUnitsSold} karopka sotildi</p>
          </div>

          {/* 2. Foyda */}
          <div className="card p-3 bg-gradient-to-br from-white to-green-50/40 border border-green-200/80 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Yalpi Foyda</span>
              <TrendingUp size={14} className="text-green-600 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-green-700 truncate">{formatUZS(stats.todayGrossProfit)}</p>
            <p className="text-[10px] text-green-800 font-semibold mt-0.5 truncate">{stats.todayMargin}% marja</p>
          </div>

          {/* 3. Buyurtma */}
          <div className="card p-3 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Buyurtmalar</span>
              <ShoppingCart size={14} className="text-charcoal flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-charcoal">{stats.todayOrdersCount} ta</p>
            <p className="text-[10px] text-muted mt-0.5 truncate">
              {stats.newOrdersCount > 0 ? (
                <span className="text-blue-600 font-bold">{stats.newOrdersCount} ta yangi</span>
              ) : (
                'Barchasi ko‘rilgan'
              )}
            </p>
          </div>

          {/* 4. Ombor Mavjud */}
          <div className="card p-3 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Ombor Zaxirasi</span>
              <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-charcoal">{stats.totalAvailable}</p>
            <p className="text-[10px] text-muted mt-0.5 truncate">Mavjud karopka</p>
          </div>

          {/* 5. Band (Rezerv) */}
          <div className="card p-3 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Band (Rezerv)</span>
              <Clock size={14} className="text-amber-600 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-amber-700">{stats.totalReserved}</p>
            <p className="text-[10px] text-muted mt-0.5 truncate">Mijoz bandida</p>
          </div>

          {/* 6. Ogohlantirish */}
          <div className="card p-3 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Ogohlantirish</span>
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-amber-600">
              {stats.lowStockCount + stats.outOfStockCount} ta
            </p>
            <p className="text-[10px] text-muted mt-0.5 truncate">
              {stats.outOfStockCount > 0 ? `${stats.outOfStockCount} tugagan` : `${stats.lowStockCount} kam`}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Admin 1. Buyurtmalar */}
          <div className="card p-3 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Buyurtmalar</span>
              <ShoppingCart size={14} className="text-charcoal flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-charcoal">{stats.todayOrdersCount} ta</p>
            <p className="text-[10px] text-muted mt-0.5 truncate">
              {stats.newOrdersCount > 0 ? (
                <span className="text-blue-600 font-bold">{stats.newOrdersCount} ta yangi</span>
              ) : (
                'Barchasi ko‘rilgan'
              )}
            </p>
          </div>

          {/* Admin 2. Ombor Mavjud */}
          <div className="card p-3 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Ombor Zaxirasi</span>
              <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-charcoal">{stats.totalAvailable}</p>
            <p className="text-[10px] text-muted mt-0.5 truncate">Mavjud karopka</p>
          </div>

          {/* Admin 3. Rezerv */}
          <div className="card p-3 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Band (Rezerv)</span>
              <Clock size={14} className="text-amber-600 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-amber-700">{stats.totalReserved}</p>
            <p className="text-[10px] text-muted mt-0.5 truncate">Mijoz bandida</p>
          </div>

          {/* Admin 4. Kam qoldi */}
          <div className="card p-3 bg-white border border-border shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Kam Qoldi</span>
              <TrendingDown size={14} className="text-amber-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-charcoal">{stats.lowStockCount} ta</p>
            <p className="text-[10px] text-amber-700 mt-0.5 truncate">Minimal zaxirada</p>
          </div>

          {/* Admin 5. Tugagan */}
          <div className="card p-3 bg-white border border-border shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-xs text-muted mb-1 font-semibold">
              <span className="truncate">Tugagan</span>
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-black text-red-600">{stats.outOfStockCount} ta</p>
            <p className="text-[10px] text-red-600 mt-0.5 truncate">Zaxira = 0</p>
          </div>
        </div>
      )}

      {/* ===== TWO-COLUMN INTERACTIVE OVERVIEW ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Oxirgi Buyurtmalar */}
        <div className="card p-4 bg-white border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-olive" />
              <h2 className="text-sm font-bold text-charcoal">Oxirgi Buyurtmalar</h2>
              {stats.newOrdersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {stats.newOrdersCount} yangi
                </span>
              )}
            </div>
            <Link
              href="/admin/orders"
              className="text-xs font-semibold text-olive hover:text-charcoal inline-flex items-center gap-1 transition-colors"
            >
              <span>Barchasi</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {stats.recentOrders.length > 0 ? (
            <div className="divide-y divide-border">
              {stats.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="py-2.5 flex items-center justify-between hover:bg-ivory-100/60 px-2 rounded-lg transition-colors group"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-charcoal group-hover:text-olive transition-colors">
                        #{order.order_number}
                      </span>
                      <span className="text-xs font-medium text-charcoal truncate">
                        {order.customer_name}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted truncate">
                      {formatPhone(order.phone)} · {order.total_boxes} karopka ({order.total_weight} kg)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={order.status} className="text-[10px] px-2 py-0.5" />
                    <span className="text-[10px] text-muted hidden sm:inline">
                      {formatDate(order.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted">
              Hozircha yangi buyurtmalar yo‘q
            </div>
          )}
        </div>

        {/* Right Column: Zaxira Ogohlantirishlari (Kam qolganlar & Tugaganlar) */}
        <div className="card p-4 bg-white border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="text-sm font-bold text-charcoal">Zaxira Ogohlantirishlari</h2>
              {(stats.lowStockCount + stats.outOfStockCount) > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  {stats.lowStockCount + stats.outOfStockCount} ta
                </span>
              )}
            </div>
            <Link
              href="/admin/stock"
              className="text-xs font-semibold text-olive hover:text-charcoal inline-flex items-center gap-1 transition-colors"
            >
              <span>Omborga o‘tish</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {stats.alertItems.length > 0 ? (
            <div className="divide-y divide-border">
              {stats.alertItems.map((prod) => {
                const min = prod.minimum_stock ?? prod.low_stock_threshold ?? 5
                const isOut = prod.available_stock === 0
                return (
                  <div
                    key={prod.id}
                    className="py-2.5 flex items-center justify-between hover:bg-ivory-100/60 px-2 rounded-lg transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="text-xs font-mono font-bold text-charcoal truncate">SKU: {prod.sku || prod.name}</p>
                      <p className="text-[11px] text-muted truncate">
                        {prod.unit_name || 'Qop'} · Min zaxira: {min}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isOut
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isOut ? 'Tugagan (0)' : `Qoldi: ${prod.available_stock}`}
                      </span>
                      <Link
                        href="/admin/stock"
                        className="text-[11px] font-semibold text-olive hover:underline"
                        title="Zaxirani to‘ldirish"
                      >
                        + Kirim
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted flex flex-col items-center justify-center gap-1">
              <CheckCircle size={20} className="text-green-600" />
              <span>Barcha mahsulotlar zaxirasi yetarli darajada</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== QUICK ACCESS SHORTCUTS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/admin/products"
          className="card p-3.5 bg-gradient-to-r from-ivory-100/80 to-white hover:shadow-card-hover border border-border transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-olive-50 flex items-center justify-center text-olive group-hover:bg-olive group-hover:text-white transition-colors">
              <Package size={18} />
            </div>
            <div>
              <h3 className="font-bold text-charcoal text-xs sm:text-sm">Mahsulotlar Katalogi</h3>
              <p className="text-[11px] text-muted">Barcha mahsulotlar va narxlar</p>
            </div>
          </div>
          <ArrowRight size={15} className="text-muted group-hover:text-charcoal group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          href="/admin/stock"
          className="card p-3.5 bg-gradient-to-r from-ivory-100/80 to-white hover:shadow-card-hover border border-border transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-olive-50 flex items-center justify-center text-olive group-hover:bg-olive group-hover:text-white transition-colors">
              <Boxes size={18} />
            </div>
            <div>
              <h3 className="font-bold text-charcoal text-xs sm:text-sm">Ombor Zaxirasi</h3>
              <p className="text-[11px] text-muted">Kirim, chiqim va inventarizatsiya</p>
            </div>
          </div>
          <ArrowRight size={15} className="text-muted group-hover:text-charcoal group-hover:translate-x-0.5 transition-all" />
        </Link>

        {isOwner ? (
          <Link
            href="/admin/reports"
            className="card p-3.5 bg-gradient-to-r from-ivory-100/80 to-white hover:shadow-card-hover border border-border transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-olive-50 flex items-center justify-center text-olive group-hover:bg-olive group-hover:text-white transition-colors">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="font-bold text-charcoal text-xs sm:text-sm">Moliyaviy Hisobotlar</h3>
                <p className="text-[11px] text-muted">Tushum, foyda va ertangi kun rejasi</p>
              </div>
            </div>
            <ArrowRight size={15} className="text-muted group-hover:text-charcoal group-hover:translate-x-0.5 transition-all" />
          </Link>
        ) : (
          <Link
            href="/admin/orders"
            className="card p-3.5 bg-gradient-to-r from-ivory-100/80 to-white hover:shadow-card-hover border border-border transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-olive-50 flex items-center justify-center text-olive group-hover:bg-olive group-hover:text-white transition-colors">
                <ShoppingCart size={18} />
              </div>
              <div>
                <h3 className="font-bold text-charcoal text-xs sm:text-sm">Barcha Buyurtmalar</h3>
                <p className="text-[11px] text-muted">Mijoz zaxiralari va holatlar</p>
              </div>
            </div>
            <ArrowRight size={15} className="text-muted group-hover:text-charcoal group-hover:translate-x-0.5 transition-all" />
          </Link>
        )}
      </div>
    </div>
  )
}
