'use client'

import { useState, useEffect } from 'react'
import { Plus, Minus, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { StockBadge } from '@/components/ui/StockBadge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/validations'
import type { Product, StockMovement } from '@/types'
import { MOVEMENT_TYPE_LABELS } from '@/types'
import { createClient } from '@/lib/supabase/client'

export default function AdminStockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null)
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN')
  const [adjustQty, setAdjustQty] = useState(1)
  const [adjustReason, setAdjustReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'history'>('products')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: prods }, { data: movs }] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase
          .from('stock_movements')
          .select('*, products(name)')
          .order('created_at', { ascending: false })
          .limit(100),
      ])
      setProducts((prods as Product[]) || [])
      setMovements((movs as StockMovement[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleAdjust() {
    if (!adjustTarget || adjustQty <= 0 || !adjustReason.trim()) {
      toast.error('Barcha maydonlarni to\'ldiring')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: adjustTarget.id,
          movement_type: adjustType,
          quantity: adjustQty,
          reason: adjustReason,
        }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error); return }

      // Update local state
      setProducts((prev) =>
        prev.map((p) => p.id === adjustTarget.id ? result.data : p)
      )
      toast.success('Stock yangilandi')
      setAdjustTarget(null)
      setAdjustReason('')
      setAdjustQty(1)

      // Refresh movements
      const supabase = createClient()
      const { data } = await supabase
        .from('stock_movements')
        .select('*, products(name)')
        .order('created_at', { ascending: false })
        .limit(100)
      setMovements((data as StockMovement[]) || [])
    } catch {
      toast.error('Xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-muted py-12 text-center">Yuklanmoqda...</div>

  return (
    <div>
      <h1 className="text-xl font-bold text-charcoal mb-6">Stock Boshqaruv</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-charcoal text-charcoal'
              : 'border-transparent text-muted hover:text-charcoal'
          }`}
        >
          Mahsulotlar
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-charcoal text-charcoal'
              : 'border-transparent text-muted hover:text-charcoal'
          }`}
        >
          <History size={16} />
          Tarix
        </button>
      </div>

      {activeTab === 'products' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-ivory-100">
                <th className="text-left px-4 py-3 font-medium text-muted">Mahsulot</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Mavjud</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Band</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Jami</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-ivory-100">
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-charcoal text-xs sm:text-sm">
                      {product.sku || product.name}
                    </p>
                    <p className="text-[11px] text-muted">
                      {product.unit_name || 'Qop'} · {product.weight_per_box} kg
                    </p>
                    <StockBadge
                      availableStock={product.available_stock}
                      lowStockThreshold={product.low_stock_threshold}
                      size="sm"
                      className="mt-1"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-charcoal">
                    {product.available_stock}
                  </td>
                  <td className="px-4 py-3 text-muted">{product.reserved_stock}</td>
                  <td className="px-4 py-3 text-muted">{product.total_stock}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setAdjustTarget(product); setAdjustType('IN') }}
                        className="p-1.5 rounded hover:bg-green-50 text-muted hover:text-green-600 touch-target"
                        title="Kirim"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        onClick={() => { setAdjustTarget(product); setAdjustType('OUT') }}
                        className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600 touch-target"
                        title="Chiqim"
                      >
                        <Minus size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        movements.length === 0 ? (
          <EmptyState title="Tarix bo'sh" description="Hali hech qanday stock o'zgarishi yo'q." />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-ivory-100">
                    <th className="text-left px-4 py-3 font-medium text-muted">Sana</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Mahsulot</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Tur</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Miqdor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Oldin → Keyin</th>
                    <th className="text-left px-4 py-3 font-medium text-muted">Sabab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-ivory-100">
                      <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">
                        {formatDate(m.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-charcoal">
                        {m.products?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          m.movement_type === 'IN' || m.movement_type === 'RELEASE'
                            ? 'badge-available'
                            : m.movement_type === 'RESERVE'
                            ? 'badge-low'
                            : 'badge-out'
                        }`}>
                          {MOVEMENT_TYPE_LABELS[m.movement_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {m.movement_type === 'IN' || m.movement_type === 'RELEASE' ? '+' : '-'}
                        {m.quantity}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {m.previous_available} → {m.new_available}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs max-w-xs truncate">
                        {m.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Adjust Modal */}
      <Modal
        isOpen={!!adjustTarget}
        onClose={() => { setAdjustTarget(null); setAdjustReason(''); setAdjustQty(1) }}
        title={`Stock ${adjustType === 'IN' ? 'kirim' : adjustType === 'OUT' ? 'chiqim' : 'tuzatish'}`}
      >
        {adjustTarget && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-charcoal">{adjustTarget.name}</p>
            <p className="text-xs text-muted">
              Mavjud: <span className="font-semibold">{adjustTarget.available_stock}</span> karopka
            </p>

            <div>
              <label className="label">Tur</label>
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT')}
                className="input"
              >
                <option value="IN">+ Kirim (Yangi tovar)</option>
                <option value="OUT">- Chiqim (Manual chiqarish)</option>
                <option value="ADJUSTMENT">Tuzatish (Delta)</option>
              </select>
            </div>

            <div>
              <label className="label">Miqdor (karopka)</label>
              <input
                type="number"
                min="1"
                value={adjustQty}
                onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Sabab <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="input"
                placeholder="Masalan: Yangi tovar keldi"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setAdjustTarget(null)} className="btn-secondary flex-1">
                Bekor
              </button>
              <button
                onClick={handleAdjust}
                disabled={saving || !adjustReason.trim()}
                className="btn-primary flex-1"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
