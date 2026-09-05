import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { CheckCircle, MapPin, Send, ArrowLeft } from 'lucide-react'
import type { Order, OrderItem } from '@/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ num?: string }>
}

export const dynamic = 'force-dynamic'

export default async function OrderSuccessPage({ params, searchParams }: Props) {
  const { id } = await params
  const { num } = await searchParams

  let order: Order | null = null

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single()
    order = data as Order
  } catch {
    // Ignore — show generic success with order number from URL
  }

  const orderNumber = order?.order_number || num || 'N/A'

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 md:py-20">
      {/* Success state */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-olive-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-olive" />
        </div>
        <h1 className="text-2xl font-bold text-charcoal">Buyurtmangiz qabul qilindi!</h1>
        <p className="text-muted mt-2">Ombor xodimi tez orada tayyorlaydi.</p>
      </div>

      {/* Order number */}
      <div className="card p-6 mb-6 text-center">
        <p className="text-xs text-muted uppercase tracking-widest mb-1">Buyurtma raqami</p>
        <p className="text-3xl font-bold text-charcoal">{orderNumber}</p>
        <p className="text-xs text-muted mt-2">
          Ushbu raqamni saqlang — omborga kelganda kerak bo&apos;ladi.
        </p>
      </div>

      {/* Order items */}
      {order?.order_items && order.order_items.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-charcoal mb-4 text-sm">Buyurtma tarkibi</h2>
          <div className="space-y-3">
            {order.order_items.map((item: OrderItem) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="font-mono font-bold text-charcoal">
                  SKU: {item.sku_snapshot || item.product_name_snapshot}
                </span>
                <span className="text-muted">
                  {item.quantity_boxes} qadoq · {item.total_weight} kg
                </span>
              </div>
            ))}
            <div className="divider pt-3 mt-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>Jami:</span>
                <span>{order.total_boxes} karopka / {order.total_weight} kg</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="card p-5 bg-olive-50 border-olive-100 mb-6">
        <p className="text-sm text-olive-700 leading-relaxed">
          📦 Buyurtmangiz ombor xodimiga yuborildi va mahsulot band qilindi. Omborga kelganda{' '}
          <strong>{orderNumber}</strong> raqamni ko&apos;rsating.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <a
          href="https://maps.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          <MapPin size={18} />
          Ombor manzilini ko&apos;rish
        </a>
        <a
          href="https://t.me/otaniyoz_lutfiyev"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-olive w-full flex items-center justify-center gap-2"
        >
          <Send size={18} />
          Telegram orqali bog&apos;lanish (@otaniyoz_lutfiyev)
        </a>
        <Link href="/products" className="btn-ghost w-full flex items-center justify-center gap-1">
          <ArrowLeft size={16} />
          Mahsulotlarga qaytish
        </Link>
      </div>
    </div>
  )
}
