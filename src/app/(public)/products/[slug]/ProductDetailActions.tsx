'use client'

import { useState } from 'react'
import { ShoppingBag, Check } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { QuantitySelector } from '@/components/ui/QuantitySelector'
import { useOrderStore } from '@/store/orderStore'
import { getStockStatus } from '@/types'
import type { Product } from '@/types'
import { trackAddToOrder } from '@/lib/analytics'

interface ProductDetailActionsProps {
  product: Product
}

export function ProductDetailActions({ product }: ProductDetailActionsProps) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const { addItem } = useOrderStore()

  const status = getStockStatus(product)
  const isOutOfStock = status === 'out'

  function handleAdd() {
    if (isOutOfStock) return

    const sku = product.sku || 'PRD'
    const unit = product.unit_name || 'Qop'
    const price = product.selling_price || product.price || 0

    addItem({
      productId: product.id,
      sku,
      unitName: unit,
      quantity,
      weightPerBox: product.weight_per_box,
      availableStock: product.available_stock,
      imageUrl: product.image_url,
      sellingPrice: price,
    })

    toast.success(`${sku} buyurtmaga qo‘shildi`)
    setAdded(true)
    setTimeout(() => setAdded(false), 2500)
  }

  if (isOutOfStock) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center">
        <p className="text-sm text-muted">Bu mahsulot hozirda mavjud emas</p>
        <a
          href="https://t.me/otaniyoz_lutfiyev"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary mt-3 w-full inline-flex items-center justify-center gap-2"
        >
          Telegram orqali so&apos;rash (@otaniyoz_lutfiyev)
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Miqdor ({product.unit_name})</label>
        <div className="flex items-center gap-4">
          <QuantitySelector
            value={quantity}
            min={1}
            max={product.available_stock}
            onChange={setQuantity}
            size="lg"
          />
          <p className="text-sm text-muted">
            Jami: {quantity * product.weight_per_box} kg
          </p>
        </div>
        <p className="text-xs text-muted mt-1">
          Maksimal: {product.available_stock} {product.unit_name}
        </p>
      </div>

      <button
        onClick={handleAdd}
        className={
          added
            ? 'btn-secondary w-full'
            : 'btn-primary-lg'
        }
      >
        {added ? (
          <>
            <Check size={18} />
            Buyurtmaga qo&apos;shildi
          </>
        ) : (
          <>
            <ShoppingBag size={18} />
            Buyurtmaga qo&apos;shish
          </>
        )}
      </button>

      {added && (
        <Link href="/checkout" className="btn-olive w-full flex items-center justify-center gap-2">
          Buyurtmani rasmiylashtirish →
        </Link>
      )}
    </div>
  )
}
