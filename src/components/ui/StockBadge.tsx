'use client'

import { cn } from '@/lib/validations'
import { getStockStatus } from '@/types'

interface StockBadgeProps {
  availableStock: number
  lowStockThreshold: number
  unitName?: string
  className?: string
  size?: 'sm' | 'md'
}

type BadgeStatus = 'available' | 'low' | 'out'

const STATUS_CONFIG: Record<BadgeStatus, { dot: string; label: (qty: number, unit: string) => string; badge: string }> = {
  available: {
    dot: 'bg-stock-available',
    label: (qty: number, unit: string) => `${qty} ${unit} mavjud`,
    badge: 'badge-available',
  },
  low: {
    dot: 'bg-stock-low',
    label: (qty: number, unit: string) => `${qty} ${unit} qoldi`,
    badge: 'badge-low',
  },
  out: {
    dot: 'bg-stock-out',
    label: () => 'Hozircha mavjud emas',
    badge: 'badge-out',
  },
}


export function StockBadge({
  availableStock,
  lowStockThreshold,
  unitName = 'karopka',
  className,
  size = 'md',
}: StockBadgeProps) {
  const status = getStockStatus({ available_stock: availableStock, low_stock_threshold: lowStockThreshold })
  const config = STATUS_CONFIG[status]

  return (
    <span className={cn(config.badge, size === 'sm' && 'text-xs px-2 py-0.5', className)}>
      <span className={cn('rounded-full flex-shrink-0', config.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {config.label(availableStock, unitName)}
    </span>
  )
}
