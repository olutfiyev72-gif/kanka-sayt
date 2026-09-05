'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Eye } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatPhone } from '@/lib/validations'
import type { Order, OrderStatus } from '@/types'
import { createClient } from '@/lib/supabase/client'

const STATUS_TABS: { value: 'ALL' | OrderStatus; label: string }[] = [
  { value: 'ALL', label: 'Barchasi' },
  { value: 'NEW', label: 'Yangi' },
  { value: 'CONFIRMED', label: 'Tasdiqlangan' },
  { value: 'READY', label: 'Tayyor' },
  { value: 'COMPLETED', label: 'Berildi' },
  { value: 'CANCELLED', label: 'Bekor' },
]

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL')
  const [search, setSearch] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'ALL') query = query.eq('status', statusFilter)
    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    const { data } = await query.limit(100)
    setOrders((data as Order[]) || [])
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  return (
    <div>
      <h1 className="text-xl font-bold text-charcoal mb-6">Buyurtmalar</h1>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto no-scrollbar">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-charcoal text-white'
                : 'bg-white text-muted hover:bg-ivory-200 border border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Buyurtma raqami, ism, telefon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted">Yuklanmoqda...</div>
      ) : orders.length === 0 ? (
        <EmptyState variant="orders" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-ivory-100">
                  <th className="text-left px-4 py-3 font-medium text-muted">№</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Mijoz</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Telefon</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Jami</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Sana</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Holat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-ivory-100 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-charcoal">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 font-medium text-charcoal">
                      {order.customer_name}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatPhone(order.phone)}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {order.total_boxes} karopka / {order.total_weight} kg
                    </td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="p-1.5 rounded hover:bg-ivory-200 text-muted hover:text-charcoal inline-flex"
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
