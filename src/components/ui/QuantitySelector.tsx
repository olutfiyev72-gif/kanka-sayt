'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/validations'

interface QuantitySelectorProps {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function QuantitySelector({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  size = 'md',
  className,
}: QuantitySelectorProps) {
  const canDecrease = value > min && !disabled
  const canIncrease = value < max && !disabled

  const sizes = {
    sm: { btn: 'w-8 h-8', input: 'w-10 text-sm', icon: 14 },
    md: { btn: 'w-10 h-10', input: 'w-12 text-base', icon: 16 },
    lg: { btn: 'w-12 h-12', input: 'w-14 text-lg', icon: 18 },
  }

  const s = sizes[size]

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => canDecrease && onChange(value - 1)}
        disabled={!canDecrease}
        aria-label="Kamaytirish"
        className={cn(
          'flex items-center justify-center rounded-lg border border-border',
          'bg-white transition-all duration-100',
          'touch-target',
          canDecrease
            ? 'hover:bg-ivory-200 active:scale-95 text-charcoal'
            : 'opacity-30 cursor-not-allowed text-muted',
          s.btn
        )}
      >
        <Minus size={s.icon} strokeWidth={2} />
      </button>

      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const num = parseInt(e.target.value, 10)
          if (!isNaN(num)) {
            onChange(Math.min(Math.max(min, num), max))
          }
        }}
        aria-label="Miqdor"
        className={cn(
          'text-center font-semibold text-charcoal bg-white',
          'border border-border rounded-lg h-10',
          'focus:outline-none focus:ring-2 focus:ring-olive',
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          s.input
        )}
      />

      <button
        type="button"
        onClick={() => canIncrease && onChange(value + 1)}
        disabled={!canIncrease}
        aria-label="Ko'paytirish"
        className={cn(
          'flex items-center justify-center rounded-lg border border-border',
          'bg-white transition-all duration-100',
          'touch-target',
          canIncrease
            ? 'hover:bg-ivory-200 active:scale-95 text-charcoal'
            : 'opacity-30 cursor-not-allowed text-muted',
          s.btn
        )}
      >
        <Plus size={s.icon} strokeWidth={2} />
      </button>
    </div>
  )
}
