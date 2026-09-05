'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle, Package, XCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDate, formatPhone } from '@/lib/validations'
import type { Order, OrderStatus } from '@/types'
import { ORDER_STATUS_LABELS } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_ACTIONS: Record<OrderStatus, { label: string; next: OrderStatus; color: string }[]> = {
  NEW: [
    { label: 'Tasdiqlash', next: 'CONFIRMED', color: 'btn-primary' },
    { label: 'Bekor qilish', next: 'CANCELLED', color: 'btn-danger' },
  ],
  CONFIRMED: [
    { label: 'Tayyor', next: 'READY', color: 'btn-olive' },
    { label: 'Bekor qilish', next: 'CANCELLED', color: 'btn-danger' },
  ],
  READY: [
    { label: 'Berildi', next: 'COMPLETED', color: 'btn-primary' },
  ],
  COMPLETED: [],
  CANCELLED: [],
}

export default function AdminOrderDetailPage({ params }: Props) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ next: OrderStatus; label: string } | null>(null)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    async function loadOrder() {
      const { id } = await params
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .single()
      setOrder(data as Order)
      setLoading(false)
    }
    loadOrder()
  }, [params])

  async function changeStatus(newStatus: OrderStatus) {
    if (!order) return
    setChanging(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error); return }

      setOrder((prev) => prev ? { ...prev, status: newStatus } : prev)
      toast.success(`Status: ${ORDER_STATUS_LABELS[newStatus]}`)
      setConfirmAction(null)
    } catch {
      toast.error('Xatolik yuz berdi')
    } finally {
      setChanging(false)
    }
  }

  if (loading) return <div className="text-muted py-12 text-center">Yuklanmoqda...</div>
  if (!order) return <div className="text-muted py-12 text-center">Buyurtma topilmadi</div>

  const actions = STATUS_ACTIONS[order.status]

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/orders" className="btn-ghost -ml-2">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-charcoal">{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-muted mt-0.5">{formatDate(order.created_at)}</p>
        </div>
      </div>

      {/* Customer */}
      <div className="admin-card mb-4">
        <h2 className="font-semibold text-charcoal mb-3 text-sm">Mijoz ma&apos;lumoti</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Ism:</span>
            <span className="font-medium text-charcoal">{order.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Telefon:</span>
            <a href={`tel:${order.phone}`} className="font-medium text-olive hover:underline">
              {formatPhone(order.phone)}
            </a>
          </div>
          {order.visit_time && (
            <div className="flex justify-between">
              <span className="text-muted">Kelish vaqti:</span>
              <span className="font-medium">{formatDate(order.visit_time)}</span>
            </div>
          )}
          {order.note && (
            <div>
              <span className="text-muted">Izoh:</span>
              <p className="mt-1 text-charcoal bg-ivory-100 rounded p-2 text-xs">{order.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="admin-card mb-4">
        <h2 className="font-semibold text-charcoal mb-3 text-sm">Mahsulotlar</h2>
        <div className="space-y-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-ivory-200 flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-muted" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-mono font-bold text-charcoal">
                  SKU: {item.sku_snapshot || item.product_name_snapshot}
                </p>
                <p className="text-xs text-muted">
                  1 qadoq = {item.weight_per_box_snapshot} kg
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-charcoal">{item.quantity_boxes} karopka</p>
                <p className="text-xs text-muted">{item.total_weight} kg</p>
              </div>
            </div>
          ))}

          <div className="divider pt-3 mt-3">
            <div className="flex justify-between text-sm font-bold">
              <span>Jami:</span>
              <span>{order.total_boxes} karopka / {order.total_weight} kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Actions */}
      {actions.length > 0 && (
        <div className="admin-card">
          <h2 className="font-semibold text-charcoal mb-3 text-sm">Amallar</h2>
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <button
                key={action.next}
                onClick={() => setConfirmAction(action)}
                className={action.color}
              >
                {action.next === 'COMPLETED' && <CheckCircle size={16} />}
                {action.next === 'CANCELLED' && <XCircle size={16} />}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && changeStatus(confirmAction.next)}
        title={`${confirmAction?.label}ni tasdiqlaysizmi?`}
        message={
          confirmAction?.next === 'CANCELLED'
            ? 'Buyurtma bekor qilinsa, band qilingan stock avtomatik qaytariladi.'
            : confirmAction?.next === 'COMPLETED'
            ? 'Buyurtma yakunlanganda stock hisobdan chiqariladi.'
            : `Status "${ORDER_STATUS_LABELS[confirmAction?.next || 'NEW']}" ga o\'zgartiriladi.`
        }
        confirmLabel={confirmAction?.label || 'Tasdiqlash'}
        variant={confirmAction?.next === 'CANCELLED' ? 'danger' : 'default'}
        isLoading={changing}
      />
    </div>
  )
}
