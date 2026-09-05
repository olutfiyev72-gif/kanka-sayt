'use client'

import type { OrderStatus } from '@/types'
import { ORDER_STATUS_LABELS } from '@/types'
import { cn } from '@/lib/validations'

interface StatusBadgeProps {
  status: OrderStatus
  className?: string
}

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  NEW: 'badge-new',
  CONFIRMED: 'badge-confirmed',
  READY: 'badge-ready',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(STATUS_BADGE_CLASS[status], className)}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}
