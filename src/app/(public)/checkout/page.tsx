'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2, Package, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useOrderStore } from '@/store/orderStore'
import { checkoutSchema, type CheckoutFormData, formatWeight } from '@/lib/validations'
import { QuantitySelector } from '@/components/ui/QuantitySelector'
import { EmptyState } from '@/components/ui/EmptyState'
import { trackBeginOrder, trackSubmitOrder } from '@/lib/analytics'
import { formatUZS } from '@/lib/pricing'

export default function CheckoutPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLock = useRef(false)  // Prevent double-submit

  const { items, removeItem, updateQuantity, clearOrder, getTotalBoxes, getTotalWeight } =
    useOrderStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  })

  const totalBoxes = getTotalBoxes()
  const totalWeight = getTotalWeight()

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <EmptyState
          variant="orders"
          title="Buyurtmangiz bo'sh"
          description="Hech qanday mahsulot qo'shilmagan."
          action={
            <Link href="/products" className="btn-primary">
              Mahsulotlarga qaytish
            </Link>
          }
        />
      </div>
    )
  }

  async function onSubmit(data: CheckoutFormData) {
    // Prevent double submission
    if (submitLock.current) return
    submitLock.current = true
    setIsSubmitting(true)

    try {
      const payload = {
        customer_name: data.customer_name,
        phone: data.phone,
        visit_time: data.visit_time || null,
        note: data.note || null,
        items: items.map((item) => ({
          product_id: item.productId,
          quantity_boxes: item.quantity,
        })),
      }

      trackBeginOrder()

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.code === 'INSUFFICIENT_STOCK') {
          toast.error(
            result.error || 'Stock o\'zgardi. Buyurtmangizni qayta tekshiring.',
            { duration: 5000 }
          )
        } else {
          toast.error(result.error || 'Xatolik yuz berdi')
        }
        submitLock.current = false
        return
      }

      // Success
      const orderData = result.data
      trackSubmitOrder(orderData.order_number, orderData.total_boxes)
      clearOrder()
      router.push(`/order-success/${orderData.order_id}?num=${orderData.order_number}`)

    } catch (error) {
      console.error('[Checkout submit error]', error)
      toast.error('Tarmoq xatoligi. Internet aloqangizni tekshiring.')
      submitLock.current = false
    } finally {
      setIsSubmitting(false)
      if (!submitLock.current) submitLock.current = false
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Back */}
      <Link href="/products" className="btn-ghost mb-6 -ml-2 inline-flex items-center gap-1">
        <ArrowLeft size={16} />
        Mahsulotlarga qaytish
      </Link>

      <h1 className="section-title mb-8">Buyurtmani rasmiylashtirish</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Order items — left */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-semibold text-charcoal">Tanlangan mahsulotlar</h2>

          <div className="card divide-y divide-border">
            {items.map((item) => (
              <div key={item.productId} className="flex items-start gap-4 p-4">
                {/* Product info */}
                <div className="w-10 h-10 rounded-lg bg-ivory-200 flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-charcoal text-sm">
                    SKU: {item.sku || item.productName}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    📦 {item.quantity} {item.unitName || 'qop'} · ⚖️ {item.quantity * item.weightPerBox} kg ({item.weightPerBox} kg/{item.unitName || 'qop'})
                  </p>
                  {item.sellingPrice && item.sellingPrice > 0 && (
                    <p className="text-xs font-bold text-olive mt-0.5">
                      {formatUZS(item.sellingPrice)} × {item.quantity} = {formatUZS(item.sellingPrice * item.quantity)}
                    </p>
                  )}
                  {item.availableStock < item.quantity && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠ Faqat {item.availableStock} ta mavjud
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div className="flex items-center gap-2">
                  <QuantitySelector
                    value={item.quantity}
                    min={1}
                    max={item.availableStock}
                    onChange={(qty) => updateQuantity(item.productId, qty)}
                    size="sm"
                  />
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label={`${item.productName}ni o'chirish`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="card p-4 bg-ivory-100">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted">Jami karopka:</span>
              <span className="font-semibold">{totalBoxes} karopka</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Jami og&apos;irlik:</span>
              <span className="font-semibold">{totalWeight} kg</span>
            </div>
          </div>
        </div>

        {/* Checkout form — right */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4" noValidate>
            <h2 className="font-semibold text-charcoal">Ma&apos;lumotlaringiz</h2>

            {/* Name */}
            <div>
              <label htmlFor="customer_name" className="label">
                Ism / Kompaniya nomi <span className="text-red-500">*</span>
              </label>
              <input
                id="customer_name"
                type="text"
                placeholder="Isming yoki kompaniya nomi"
                className={`input ${errors.customer_name ? 'input-error' : ''}`}
                {...register('customer_name')}
                autoComplete="name"
              />
              {errors.customer_name && (
                <p className="error-msg">{errors.customer_name.message}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="label">
                Telefon raqam <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+998 90 000 00 00"
                className={`input ${errors.phone ? 'input-error' : ''}`}
                {...register('phone')}
                autoComplete="tel"
                inputMode="tel"
              />
              {errors.phone && (
                <p className="error-msg">{errors.phone.message}</p>
              )}
            </div>

            {/* Visit time — optional */}
            <div>
              <label htmlFor="visit_time" className="label">
                Kelish vaqti{' '}
                <span className="text-muted font-normal">(ixtiyoriy)</span>
              </label>
              <input
                id="visit_time"
                type="datetime-local"
                className="input"
                {...register('visit_time')}
              />
            </div>

            {/* Note — optional */}
            <div>
              <label htmlFor="note" className="label">
                Izoh{' '}
                <span className="text-muted font-normal">(ixtiyoriy)</span>
              </label>
              <textarea
                id="note"
                rows={3}
                placeholder="Qo'shimcha ma'lumot..."
                className="input resize-none"
                {...register('note')}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary-lg mt-2"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Yuborilmoqda...
                </>
              ) : (
                'BUYURTMANI TASDIQLASH'
              )}
            </button>

            <p className="text-xs text-muted text-center">
              Online to&apos;lov talab qilinmaydi. To&apos;lov omborga kelganda amalga oshiriladi.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
