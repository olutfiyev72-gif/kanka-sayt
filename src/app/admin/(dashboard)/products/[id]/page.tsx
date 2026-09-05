'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, X } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { calculateSellingPrice, formatUZS } from '@/lib/pricing'
import type { Product } from '@/types'

const PACKAGE_TYPES = ['Qop', 'Karopka', 'Quti', 'Meshok', 'Banka', 'Dona']

interface Props {
  params: Promise<{ id: string }>
}

export default function EditProductPage({ params }: Props) {
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [markupPercent, setMarkupPercent] = useState(15)

  useEffect(() => {
    async function load() {
      const { id } = await params
      const supabase = createClient()
      const { data } = await supabase.from('products').select('*').eq('id', id).single()
      if (data) {
        setProduct({
          ...data,
          sku: data.sku || data.name || '',
          unit_name: data.unit_name || 'Qop',
          minimum_stock: data.minimum_stock ?? data.low_stock_threshold ?? 5,
          cost_price: data.cost_price || 0,
        } as Product)
        if (data.cost_price && data.selling_price) {
          const m = Math.round(((data.selling_price - data.cost_price) / data.cost_price) * 100)
          setMarkupPercent(m > 0 ? m : 15)
        }
      }
      setLoading(false)
    }
    load()
  }, [params])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-xs text-muted">
        Yuklanmoqda...
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-2">
        <p className="text-sm font-bold text-charcoal">Mahsulot topilmadi</p>
        <Link href="/admin/products" className="btn-secondary text-xs">
          ← Ro‘yxatga qaytish
        </Link>
      </div>
    )
  }

  const costPrice = Number(product.cost_price) || 0
  const weightPerBox = Number(product.weight_per_box) || 0
  const availableStock = Number(product.available_stock) || 0
  const totalWeightKg = availableStock * weightPerBox
  const sellingPrice = calculateSellingPrice(costPrice, markupPercent)
  const totalCostValue = availableStock * costPrice
  const totalSellingValue = availableStock * sellingPrice

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !product) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fayl hajmi 5 MB dan kichik bo‘lsin')
      return
    }

    setImageUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `products/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('images').upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName)
      setProduct((prev) => (prev ? { ...prev, image_url: publicUrl } : prev))
      toast.success('Rasm yuklandi')
    } catch {
      const previewUrl = URL.createObjectURL(file)
      setProduct((prev) => (prev ? { ...prev, image_url: previewUrl } : prev))
      toast.success('Rasm tanlandi (preview)')
    } finally {
      setImageUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!product) return

    const cleanSku = (product.sku || '').trim().toUpperCase()
    if (!cleanSku) {
      toast.error('SKU / Maxsus belgi kiritilishi shart')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: cleanSku,
          unit_name: product.unit_name || 'Qop',
          weight_per_box: Number(product.weight_per_box) || 10,
          cost_price: Number(product.cost_price) || 0,
          markup_percent: markupPercent,
          description: product.description,
          image_url: product.image_url,
          is_active: product.is_active,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Xatolik yuz berdi')
        return
      }
      toast.success('Mahsulot muvaffaqiyatli yangilandi')
      router.push('/admin/products')
      router.refresh()
    } catch {
      toast.error('Xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/products" className="btn-ghost -ml-2 text-muted hover:text-charcoal">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-charcoal tracking-tight">
            Mahsulotni Tahrirlash: {product.sku}
          </h1>
          <p className="text-xs text-muted">SKU, qadoq, tannarx va tavsifni o‘zgartirish</p>
        </div>
      </div>

      {/* Main Compact Form Card */}
      <div className="card p-5 sm:p-6 bg-white border border-border shadow-xs">
        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. SKU / Maxsus belgi */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              SKU / Maxsus belgi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={product.sku}
              onChange={(e) => setProduct({ ...product, sku: e.target.value.toUpperCase() })}
              className="input font-mono uppercase text-sm"
              placeholder="Masalan: RICE-001"
              required
            />
            <p className="text-[10px] text-muted mt-0.5">Asosiy identifikator. Mahsulot nomi ishlatilmaydi.</p>
          </div>

          {/* 2. Qadoq turi & 1 qadoq og‘irligi (kg) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Qadoq turi <span className="text-red-500">*</span>
              </label>
              <select
                className="input text-sm cursor-pointer"
                value={product.unit_name || 'Qop'}
                onChange={(e) => setProduct({ ...product, unit_name: e.target.value })}
              >
                {PACKAGE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                1 qadoq og‘irligi (kg) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="input text-sm pr-10"
                  value={product.weight_per_box}
                  onChange={(e) =>
                    setProduct({ ...product, weight_per_box: Number(e.target.value) })
                  }
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                  kg
                </span>
              </div>
            </div>
          </div>

          {/* 3. Ombor qoldig‘i (Read-only on edit, managed via /stock) */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              Ombor qoldig‘i
            </label>
            <div className="p-3 rounded-xl bg-ivory-100/80 border border-border flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-charcoal">
                  📦 {availableStock} {product.unit_name?.toLowerCase()} mavjud
                  {product.reserved_stock > 0 && ` (${product.reserved_stock} rezervda)`}
                </p>
                <p className="text-olive font-medium">
                  ⚖️ Jami vazn: {totalWeightKg.toLocaleString('uz-UZ')} kg
                </p>
              </div>
              <Link
                href="/admin/stock"
                className="text-xs font-semibold text-olive hover:underline"
              >
                + Kirim / Chiqim
              </Link>
            </div>
          </div>

          {/* 4. Tannarx & Ustama % */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Tannarx (1 {product.unit_name?.toLowerCase()} uchun) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  className="input text-sm pr-14"
                  value={product.cost_price || ''}
                  onChange={(e) =>
                    setProduct({ ...product, cost_price: Number(e.target.value) })
                  }
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                  so‘m
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Ustama foizi (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  className="input text-sm pr-8"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(Number(e.target.value))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* 5. Avtomatik Sotuv Narxi & Jami Qiymat Summary */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-olive-50/50 to-white border border-olive-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-charcoal">
                💰 Sotuv narxi (1 {product.unit_name?.toLowerCase()}):
              </span>
              <span className="text-base font-black text-olive">
                {formatUZS(sellingPrice)}
              </span>
            </div>

            {availableStock > 0 && (
              <div className="pt-2 border-t border-olive-200/60 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted block">Jami ombor tannarxi:</span>
                  <span className="font-bold text-charcoal">
                    {availableStock} × {formatUZS(costPrice)} = {formatUZS(totalCostValue)}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Kutilayotgan jami tushum:</span>
                  <span className="font-bold text-green-700">
                    {availableStock} × {formatUZS(sellingPrice)} = {formatUZS(totalSellingValue)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 6. Rasm */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              🖼 Rasm (Ixtiyoriy)
            </label>

            {product.image_url ? (
              <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-border group bg-ivory-100">
                <Image src={product.image_url} alt={product.sku} fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setProduct({ ...product, image_url: null })}
                  className="absolute top-1.5 right-1.5 p-1 bg-charcoal/80 text-white rounded-full hover:bg-charcoal transition-colors"
                  title="Rasmni o‘chirish"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-ivory-50 transition-colors">
                <Upload size={20} className="text-muted mb-1" />
                <span className="text-xs font-semibold text-charcoal">
                  {imageUploading ? 'Yuklanmoqda...' : '+ Rasm yuklash (JPG, PNG, WEBP)'}
                </span>
                <span className="text-[10px] text-muted">Maksimal hajm: 5 MB</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={imageUploading}
                />
              </label>
            )}
          </div>

          {/* 7. Tavsif */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              Tavsif (Ixtiyoriy)
            </label>
            <textarea
              rows={2}
              value={product.description || ''}
              onChange={(e) => setProduct({ ...product, description: e.target.value })}
              className="input text-xs resize-none"
              placeholder="Mahsulot tafsilotlari..."
            />
          </div>

          {/* 8. Status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_active"
              checked={product.is_active}
              onChange={(e) => setProduct({ ...product, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-olive focus:ring-olive border-border"
            />
            <label htmlFor="is_active" className="text-xs font-medium text-charcoal cursor-pointer">
              Faol mahsulot (saytda mijozlarga ko‘rinadi)
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <Link href="/admin/products" className="btn-secondary py-2 px-4 text-xs">
              Bekor qilish
            </Link>
            <button
              type="submit"
              disabled={saving || imageUploading}
              className="btn-primary py-2 px-5 text-xs shadow-xs"
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
