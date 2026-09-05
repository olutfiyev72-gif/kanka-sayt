'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  AlertTriangle,
  ArrowDownCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatUZS } from '@/lib/pricing'
import type { OwnerReportsData } from '@/types'

export default function OwnerReportsPage() {
  const [data, setData] = useState<OwnerReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<string>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [topTab, setTopTab] = useState<'units' | 'revenue' | 'profit'>('profit')

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/admin/reports?period=${period}`
      if (period === 'custom' && customFrom && customTo) {
        url += `&from=${customFrom}&to=${customTo}`
      }
      const res = await fetch(url)
      const json = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Ushbu hisobotlar faqat do\'kon egasi (OWNER) uchun ochiq.')
        } else {
          toast.error(json.error || 'Hisobotlarni yuklab bo\'lmadi')
        }
        return
      }

      setData(json.data)
    } catch {
      toast.error('Server bilan aloqa uzildi')
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header & Period Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-olive-100 text-olive-800 border border-olive-300">
              OWNER EXCLUSIVE
            </span>
          </div>
          <h1 className="text-2xl font-black text-charcoal tracking-tight mt-1">
            Moliyaviy Hisobotlar & Ertangi Kun Rejalashtirish
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Tushum, sof foyda, ombor zaxirasini baholash va tovar buyurtma hisob-kitoblari
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-border shadow-xs">
          {[
            { id: 'today', label: 'Bugun' },
            { id: 'yesterday', label: 'Kecha' },
            { id: 'week', label: 'Shu hafta' },
            { id: 'month', label: 'Shu oy' },
            { id: 'custom', label: 'Sana tanlash' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                period === tab.id
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'text-muted hover:text-charcoal hover:bg-ivory-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Pickers if selected */}
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-border">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Dan:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="input py-1 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Gacha:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="input py-1 text-xs"
            />
          </div>
          <button onClick={fetchReports} className="btn-primary text-xs py-1.5 px-3">
            Hisobotni yangilash
          </button>
        </div>
      )}

      {loading && (
        <div className="py-20 text-center text-muted text-sm">
          <div className="inline-block w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin mb-2" />
          <p>Moliyaviy ma&apos;lumotlar tahlil qilinmoqda...</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Top Financial Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="card p-5 bg-gradient-to-br from-white to-olive-50/50 border border-olive-200">
              <div className="flex items-center justify-between text-xs font-semibold text-muted mb-1">
                <span>Jami Tushum (Revenue)</span>
                <DollarSign size={16} className="text-olive" />
              </div>
              <p className="text-2xl font-extrabold text-charcoal">{formatUZS(data.summary.revenue)}</p>
              <p className="text-xs text-olive font-medium mt-1">
                {data.summary.units_sold} karopka sotildi
              </p>
            </div>

            {/* Profit */}
            <div className="card p-5 bg-gradient-to-br from-white to-green-50/50 border border-green-200">
              <div className="flex items-center justify-between text-xs font-semibold text-muted mb-1">
                <span>Yalpi Foyda (Gross Profit)</span>
                <TrendingUp size={16} className="text-green-600" />
              </div>
              <p className="text-2xl font-extrabold text-green-700">{formatUZS(data.summary.gross_profit)}</p>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="font-bold text-green-800 bg-green-100 px-1.5 py-0.2 rounded">
                  {data.summary.margin_percent}%
                </span>
                <span className="text-muted">savdo marjasi</span>
              </div>
            </div>

            {/* Total Cost */}
            <div className="card p-5 bg-gradient-to-br from-white to-amber-50/50 border border-amber-200">
              <div className="flex items-center justify-between text-xs font-semibold text-muted mb-1">
                <span>Sotilgan tovarlar tannarxi (COGS)</span>
                <ArrowDownCircle size={16} className="text-amber-600" />
              </div>
              <p className="text-2xl font-extrabold text-charcoal">{formatUZS(data.summary.total_cost)}</p>
              <p className="text-xs text-muted mt-1">Tovarning xarid tannarxi</p>
            </div>

            {/* Orders summary */}
            <div className="card p-5 bg-gradient-to-br from-white to-blue-50/50 border border-blue-200">
              <div className="flex items-center justify-between text-xs font-semibold text-muted mb-1">
                <span>Buyurtmalar & Harakat</span>
                <ShoppingCart size={16} className="text-blue-600" />
              </div>
              <p className="text-2xl font-extrabold text-charcoal">{data.summary.orders_count} ta</p>
              <p className="text-xs text-muted mt-1">
                {data.summary.cancelled_orders > 0
                  ? `${data.summary.cancelled_orders} ta bekor qilingan`
                  : 'Bekor qilingan buyurtma yo\'q'}
              </p>
            </div>
          </div>

          {/* Section: ERTANGI KUN UCHUN (Reorder Planning) */}
          <div className="card p-6 bg-white border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    AVTOMATIK ZAXIRA HISOBLASH
                  </span>
                  <span className="text-xs text-muted">Formula: max(0, minimum_stock - available)</span>
                </div>
                <h2 className="text-lg font-bold text-charcoal mt-1">
                  ERTANGI KUN UCHUN OMBOORGA BUYURTMA REJASI
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-red-600 font-semibold">
                  <AlertCircle size={14} />
                  {data.inventory.out_of_stock_count} ta tugagan
                </span>
                <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                  <AlertTriangle size={14} />
                  {data.inventory.low_stock_count} ta kam qolgan
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-ivory-100 text-muted font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Mahsulot</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Jami Stock</th>
                    <th className="py-3 px-3">Band (Reserved)</th>
                    <th className="py-3 px-3">Hozir Mavjud</th>
                    <th className="py-3 px-3">Minimal Zaxira</th>
                    <th className="py-3 px-3 font-extrabold text-charcoal">Tavsiya etilgan xarid (Reorder)</th>
                    <th className="py-3 px-3 text-center">Holati</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.reorder_planning.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-ivory-50 transition-colors ${
                        item.suggested_order > 0 ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-semibold text-charcoal">{item.name}</td>
                      <td className="py-3 px-3 text-muted font-mono">{item.sku || '—'}</td>
                      <td className="py-3 px-3 text-charcoal font-medium">{item.current_stock}</td>
                      <td className="py-3 px-3 text-amber-700 font-medium">{item.reserved_stock}</td>
                      <td className="py-3 px-3 font-bold text-charcoal">{item.available_stock}</td>
                      <td className="py-3 px-3 text-muted">{item.minimum_stock}</td>
                      <td className="py-3 px-3 font-black text-sm">
                        {item.suggested_order > 0 ? (
                          <span className="text-red-700 bg-red-100 px-2 py-1 rounded-md border border-red-200 inline-block">
                            +{item.suggested_order} karopka
                          </span>
                        ) : (
                          <span className="text-green-700 font-medium">Yetarli (0)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.status === 'OUT_OF_STOCK' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            🔴 Tugagan
                          </span>
                        ) : item.status === 'LOW_STOCK' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            🟡 Kam qolgan
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                            🟢 Yetarli
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Performance & Inventory Valuation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Products */}
            <div className="lg:col-span-2 card p-6 bg-white border border-border shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <h3 className="font-bold text-charcoal text-base flex items-center gap-1.5">
                  <Sparkles size={16} className="text-olive" />
                  <span>Mahsulotlar Reytingi (Top 5)</span>
                </h3>

                <div className="flex rounded-lg bg-ivory-200 p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setTopTab('profit')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      topTab === 'profit' ? 'bg-white text-charcoal shadow-xs' : 'text-muted'
                    }`}
                  >
                    Eng ko&apos;p foyda
                  </button>
                  <button
                    onClick={() => setTopTab('revenue')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      topTab === 'revenue' ? 'bg-white text-charcoal shadow-xs' : 'text-muted'
                    }`}
                  >
                    Eng ko&apos;p tushum
                  </button>
                  <button
                    onClick={() => setTopTab('units')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      topTab === 'units' ? 'bg-white text-charcoal shadow-xs' : 'text-muted'
                    }`}
                  >
                    Eng ko&apos;p sotilgan
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {(topTab === 'profit'
                  ? data.top_by_profit
                  : topTab === 'revenue'
                  ? data.top_by_revenue
                  : data.top_by_units
                ).map((prod, idx) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-ivory-50 border border-border hover:border-olive-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-charcoal text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-charcoal text-sm">{prod.name}</p>
                        <p className="text-[11px] text-muted">
                          Sotildi: <strong className="text-charcoal">{prod.units_sold}</strong> karopka | Qoldiq:{' '}
                          <strong className="text-charcoal">{prod.current_stock}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-extrabold text-sm text-charcoal">
                        {topTab === 'profit'
                          ? `+${formatUZS(prod.gross_profit)}`
                          : formatUZS(prod.revenue)}
                      </p>
                      <p className="text-[11px] text-green-700 font-semibold">
                        {prod.margin_percent}% marja
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inventory Valuation Card */}
            <div className="card p-6 bg-white border border-border shadow-xs space-y-4">
              <h3 className="font-bold text-charcoal text-base flex items-center gap-1.5 border-b border-border pb-3">
                <Package size={16} className="text-olive" />
                <span>Ombor Qiymati (Valuation)</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-olive-50 border border-olive-200">
                  <span className="text-muted block mb-0.5">Xarid tannarxi bo&apos;yicha:</span>
                  <span className="text-xl font-black text-charcoal">
                    {formatUZS(data.inventory.total_valuation_cost)}
                  </span>
                  <span className="block text-[11px] text-muted mt-1">
                    Jami {data.inventory.total_units} ta karopka
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-green-50 border border-green-200">
                  <span className="text-muted block mb-0.5">Sotuv narxi bo&apos;yicha (15% markup):</span>
                  <span className="text-xl font-black text-green-800">
                    {formatUZS(data.inventory.total_valuation_selling)}
                  </span>
                  <span className="block text-[11px] text-green-700 font-medium mt-1">
                    Kutilayotgan potensial tushum
                  </span>
                </div>

                <div className="pt-2 border-t border-border space-y-1.5 text-muted">
                  <div className="flex justify-between">
                    <span>Mavjud zaxira:</span>
                    <strong className="text-charcoal">{data.inventory.available_units} karopka</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Band qilingan:</span>
                    <strong className="text-amber-700">{data.inventory.reserved_units} karopka</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Buyurtma talab qiluvchilar:</span>
                    <strong className="text-red-600">{data.inventory.reorder_required_count} ta tovar</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
