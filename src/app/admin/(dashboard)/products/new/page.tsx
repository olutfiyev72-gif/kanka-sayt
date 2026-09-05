'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Upload, X, Package, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { productSchema, type ProductFormData } from '@/lib/validations'
import { createClient } from '@/lib/supabase/client'
import { calculateSellingPrice, formatUZS } from '@/lib/pricing'

const PACKAGE_TYPES = ['Qop', 'Karopka', 'Quti', 'Meshok', 'Banka', 'Dona']

export default function NewProductPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      unit_name: 'Qop',
      weight_per_box: 10,
      total_stock: 0,
      cost_price: 100000,
      markup_percent: 15,
      description: '',
      is_active: true,
      minimum_stock: 5,
    },
  })

  // Reactive watches for instant live calculations
  const skuValue = watch('sku')
  const unitName = watch('unit_name') || 'Qop'
  const weightPerBox = Number(watch('weight_per_box')) || 0
  const totalStock = Number(watch('total_stock')) || 0
  const costPrice = Number(watch('cost_price')) || 0
  const markupPercent = Number(watch('markup_percent')) >= 0 ? Number(watch('markup_percent')) : 15

  // Calculations
  const totalWeightKg = totalStock * weightPerBox
  const sellingPricePerBox = calculateSellingPrice(costPrice, markupPercent)
  const totalCostValue = totalStock * costPrice
  const totalSellingValue = totalStock * sellingPricePerBox

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayllari (JPG, PNG, WEBP) qabul qilinadi')
      return
    }

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
      setImageUrl(publicUrl)
      toast.success('Rasm yuklandi')
    } catch {
      // Local preview fallback if supabase storage is offline
      const previewUrl = URL.createObjectURL(file)
      setImageUrl(previewUrl)
      toast.success('Rasm tanlandi (preview)')
    } finally {
      setImageUploading(false)
    }
  }

  async function onSubmit(data: ProductFormData) {
    setSaving(true)
    try {
      const cleanSku = data.sku.trim().toUpperCase()
      const payload = {
        ...data,
        sku: cleanSku,
        image_url: imageUrl,
        total_stock: Number(data.total_stock) || 0,
        cost_price: Number(data.cost_price) || 0,
        weight_per_box: Number(data.weight_per_box) || 10,
        markup_percent: Number(data.markup_percent) >= 0 ? Number(data.markup_percent) : 15,
        unit_name: data.unit_name || 'Qop',
        minimum_stock: 5,
        low_stock_threshold: 5,
      }

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error || 'Mahsulot yaratib bo‘lmadi')
        return
      }

      toast.success('Mahsulot muvaffaqiyatli saqlandi!')
      router.push('/admin/products')
      router.refresh()
    } catch {
      toast.error('Xatolik yuz berdi. Qayta urinib ko‘ring.')
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
          <h1 className="text-xl font-black text-charcoal tracking-tight">+ Mahsulot qo‘shish</h1>
          <p className="text-xs text-muted">SKU, qadoq, tannarx va ombor qoldig‘i</p>
        </div>
      </div>

      {/* Main Compact Form Card */}
      <div className="card p-5 sm:p-6 bg-white border border-border shadow-xs">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 1. SKU / Maxsus belgi */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              SKU / Maxsus belgi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Masalan: RICE-001, MUSK-002"
              className={`input font-mono uppercase text-sm ${errors.sku ? 'border-red-400 bg-red-50/50' : ''}`}
              {...register('sku')}
            />
            {errors.sku ? (
              <p className="text-[11px] text-red-600 mt-1">{errors.sku.message}</p>
            ) : (
              <p className="text-[10px] text-muted mt-0.5">Asosiy unikal identifikator. Takrorlanmasligi shart.</p>
            )}
          </div>

          {/* 2. Qadoq turi & 1 qadoq og‘irligi (kg) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Qadoq turi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  className="input text-sm cursor-pointer"
                  {...register('unit_name')}
                >
                  {PACKAGE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
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
                  placeholder="10"
                  className={`input text-sm pr-10 ${errors.weight_per_box ? 'border-red-400' : ''}`}
                  {...register('weight_per_box', { valueAsNumber: true })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                  kg
                </span>
              </div>
              {errors.weight_per_box && (
                <p className="text-[11px] text-red-600 mt-1">{errors.weight_per_box.message}</p>
              )}
            </div>
          </div>

          {/* 3. Qadoqlar soni & Avtomatik Hisob Vidjeti */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              Qadoqlar soni (Qoldiq) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                placeholder="41"
                className={`input text-sm pr-14 ${errors.total_stock ? 'border-red-400' : ''}`}
                {...register('total_stock', { valueAsNumber: true })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                dona
              </span>
            </div>
            {errors.total_stock && (
              <p className="text-[11px] text-red-600 mt-1">{errors.total_stock.message}</p>
            )}

            {/* Dynamic Package Summary Chips */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-ivory-100/80 border border-border text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-charcoal">
                📦 Jami: {totalStock} {unitName.toLowerCase()}
              </span>
              <span className="text-muted">·</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-olive">
                ⚖️ Jami: {totalWeightKg.toLocaleString('uz-UZ')} kg
              </span>
              {totalStock > 0 && weightPerBox > 0 && (
                <span className="text-[11px] text-muted hidden sm:inline">
                  ({totalStock} × {weightPerBox} kg)
                </span>
              )}
            </div>
          </div>

          {/* 4. Tannarx & Ustama % */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Tannarx (1 {unitName.toLowerCase()} uchun) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  placeholder="100 000"
                  className={`input text-sm pr-14 ${errors.cost_price ? 'border-red-400' : ''}`}
                  {...register('cost_price', { valueAsNumber: true })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                  so‘m
                </span>
              </div>
              {errors.cost_price && (
                <p className="text-[11px] text-red-600 mt-1">{errors.cost_price.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal mb-1">
                Ustama foizi (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  placeholder="15"
                  className="input text-sm pr-8"
                  {...register('markup_percent', { valueAsNumber: true })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* 5. Avtomatik Sotuv Narxi & Jami Qiymat Summary (Admin Only) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-olive-50/50 to-white border border-olive-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-charcoal">
                💰 Sotuv narxi (1 {unitName.toLowerCase()}):
              </span>
              <span className="text-base font-black text-olive">
                {formatUZS(sellingPricePerBox)}
              </span>
            </div>

            {totalStock > 0 && (
              <div className="pt-2 border-t border-olive-200/60 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted block">Jami ombor tannarxi:</span>
                  <span className="font-bold text-charcoal">
                    {totalStock} × {formatUZS(costPrice)} = {formatUZS(totalCostValue)}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Kutilayotgan jami tushum:</span>
                  <span className="font-bold text-green-700">
                    {totalStock} × {formatUZS(sellingPricePerBox)} = {formatUZS(totalSellingValue)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 6. Rasm yuklash (Ixtiyoriy) */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              🖼 Rasm (Ixtiyoriy)
            </label>

            {imageUrl ? (
              <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-border group bg-ivory-100">
                <Image src={imageUrl} alt={skuValue || 'Mahsulot rasmi'} fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
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

          {/* 7. Tavsif (Ixtiyoriy) */}
          <div>
            <label className="block text-xs font-bold text-charcoal mb-1">
              Tavsif (Ixtiyoriy)
            </label>
            <textarea
              rows={2}
              placeholder="Masalan: Premium sifatli, toza saralangan mahsulot..."
              className="input text-xs resize-none"
              {...register('description')}
            />
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
