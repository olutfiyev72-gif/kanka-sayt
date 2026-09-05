'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Search, Package, Eye } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import toast from 'react-hot-toast'
import { formatUZS } from '@/lib/pricing'
import type { Product } from '@/types'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
      setProducts((data as Product[]) || [])
    } catch {
      toast.error('Mahsulotlarni yuklab bo‘lmadi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  async function toggleActive(product: Product) {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !product.is_active }),
      })
      if (!res.ok) throw new Error()
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active } : p))
      )
      toast.success(product.is_active ? 'Mahsulot nofaol qilindi' : 'Mahsulot faollashtirildi')
    } catch {
      toast.error('O‘zgartirib bo‘lmadi')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'O‘chirib bo‘lmadi')
        return
      }
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      toast.success(data.message || 'Mahsulot o‘chirildi')
      setDeleteTarget(null)
    } catch {
      toast.error('Xatolik yuz berdi')
    } finally {
      setDeleting(false)
    }
  }

  // Section 10 requirement: Search strictly by SKU / Maxsus belgi
  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (p.sku && p.sku.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-black text-charcoal tracking-tight">Mahsulotlar Katalogi</h1>
          <p className="text-xs text-muted">
            SKU artikullari, qadoq turlari, tannarx va ombor qoldiqlari
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-xs"
          title="Yangi mahsulot qo‘shish"
          aria-label="Yangi mahsulot qo‘shish"
        >
          <Plus size={15} />
          <span>Mahsulot</span>
        </Link>
      </div>

      {/* Search Bar - Strictly SKU */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="SKU bo‘yicha qidirish (masalan: RICE-001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-xs font-mono"
          />
        </div>
        <span className="text-xs text-muted">Jami: {filtered.length} ta SKU</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-12 text-center text-xs text-muted">Yuklanmoqda...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="products"
          title={search ? 'Mahsulot topilmadi' : 'Hozircha mahsulotlar kiritilmagan'}
          description={
            search
              ? `"${search}" SKU bo‘yicha mahsulot topilmadi.`
              : 'Omborga birinchi mahsulotni SKU orqali qo‘shing.'
          }
          action={
            !search ? (
              <Link href="/admin/products/new" className="btn-primary text-xs">
                + Mahsulot qo‘shish
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-hidden bg-white border border-border shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100 border-b border-border text-muted font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-12">Rasm</th>
                  <th className="px-3 py-3">SKU / Maxsus belgi</th>
                  <th className="px-3 py-3">Qadoq</th>
                  <th className="px-3 py-3">1 qadoq kg</th>
                  <th className="px-3 py-3">Qoldiq</th>
                  <th className="px-3 py-3">Jami vazn</th>
                  <th className="px-3 py-3">Tannarx</th>
                  <th className="px-3 py-3">Ustama</th>
                  <th className="px-3 py-3">Sotuv narxi</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((product) => {
                  const unit = product.unit_name || 'Qop'
                  const weight = product.weight_per_box || 10
                  const stock = product.available_stock || 0
                  const totalKg = stock * weight
                  const cost = product.cost_price || 0
                  const selling = product.selling_price || product.price || 0
                  const markup =
                    cost > 0 ? Math.round(((selling - cost) / cost) * 100) : 15

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-ivory-50/60 transition-colors group"
                    >
                      {/* Rasm */}
                      <td className="px-3 py-2.5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-ivory-200 relative flex-shrink-0 border border-border/80">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.sku}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-light">
                              <Package size={18} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* SKU / Maxsus belgi */}
                      <td className="px-3 py-2.5">
                        <div className="font-mono font-bold text-charcoal text-xs">
                          {product.sku}
                        </div>
                        {product.description && (
                          <p className="text-[10px] text-muted truncate max-w-[180px]">
                            {product.description}
                          </p>
                        )}
                      </td>

                      {/* Qadoq turi */}
                      <td className="px-3 py-2.5 text-charcoal font-medium">
                        {unit}
                      </td>

                      {/* 1 qadoq og‘irligi */}
                      <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                        {weight} kg
                      </td>

                      {/* Qoldiq */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            stock === 0
                              ? 'text-red-600'
                              : stock <= (product.minimum_stock ?? 5)
                              ? 'text-amber-600'
                              : 'text-charcoal'
                          }`}
                        >
                          {stock} {unit.toLowerCase()}
                        </span>
                        {product.reserved_stock > 0 && (
                          <span className="text-[10px] text-muted block">
                            ({product.reserved_stock} rezerv)
                          </span>
                        )}
                      </td>

                      {/* Jami vazn */}
                      <td className="px-3 py-2.5 font-semibold text-olive whitespace-nowrap">
                        {totalKg.toLocaleString('uz-UZ')} kg
                      </td>

                      {/* Tannarx */}
                      <td className="px-3 py-2.5 text-muted whitespace-nowrap font-medium">
                        {formatUZS(cost)}
                      </td>

                      {/* Ustama */}
                      <td className="px-3 py-2.5 text-muted whitespace-nowrap font-medium">
                        +{markup}%
                      </td>

                      {/* Sotuv narxi */}
                      <td className="px-3 py-2.5 font-bold text-charcoal whitespace-nowrap">
                        {formatUZS(selling)}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => toggleActive(product)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold"
                          title="Faollik holatini almashtirish"
                        >
                          {product.is_active ? (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                              <ToggleRight size={13} className="text-green-600" />
                              <span>Faol</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted bg-ivory-200 px-2 py-0.5 rounded-full">
                              <ToggleLeft size={13} />
                              <span>Nofaol</span>
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/products/${product.slug || product.sku.toLowerCase()}`}
                            target="_blank"
                            className="p-1.5 rounded-lg hover:bg-ivory-200 text-muted hover:text-charcoal transition-colors"
                            title="Mijoz ko‘rinishida ochish"
                            aria-label={`${product.sku} sahifasini ko‘rish`}
                          >
                            <Eye size={14} />
                          </Link>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="p-1.5 rounded-lg hover:bg-ivory-200 text-muted hover:text-charcoal transition-colors"
                            title="Tahrirlash"
                            aria-label={`${product.sku}ni tahrirlash`}
                          >
                            <Edit size={14} />
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
                            title="O‘chirish"
                            aria-label={`${product.sku}ni o‘chirish`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Mahsulotni o‘chirish"
        message={
          deleteTarget
            ? `Haqiqatan ham "${deleteTarget.sku}" mahsulotini o‘chirmoqchimisiz? Agar unga tegishli faol buyurtmalar bo‘lsa, o‘chirib bo‘lmaydi.`
            : ''
        }
        confirmLabel={deleting ? 'O‘chirilmoqda...' : 'Ha, o‘chirish'}
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
