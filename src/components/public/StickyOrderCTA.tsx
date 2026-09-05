'use client'

import Link from 'next/link'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { useOrderStore } from '@/store/orderStore'
import { trackBeginOrder } from '@/lib/analytics'

/**
 * Sticky bottom CTA for mobile — shows only when cart has items
 * "4 karopka / 40 kg — Buyurtma"
 */
export function StickyOrderCTA() {
  const totalBoxes = useOrderStore((s) => s.getTotalBoxes())
  const totalWeight = useOrderStore((s) => s.getTotalWeight())
  const items = useOrderStore((s) => s.items)

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden pb-safe">
      <div className="bg-white border-t border-border p-3">
        <Link
          href="/checkout"
          onClick={() => trackBeginOrder()}
          className="flex items-center justify-between w-full bg-charcoal text-white rounded-xl px-5 py-3.5 active:scale-[0.98] transition-transform"
          aria-label={`Buyurtma — ${totalBoxes} karopka, ${totalWeight} kg`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag size={20} />
              <span className="absolute -top-2 -right-2 bg-olive text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {items.length}
              </span>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight">Buyurtma berish</p>
              <p className="text-xs text-white/70 leading-tight">
                {totalBoxes} karopka · {totalWeight} kg
              </p>
            </div>
          </div>
          <ChevronRight size={20} className="text-white/70" />
        </Link>
      </div>
    </div>
  )
}
