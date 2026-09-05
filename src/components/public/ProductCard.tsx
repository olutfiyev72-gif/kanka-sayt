'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ShoppingBag, Check, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { QuantitySelector } from '@/components/ui/QuantitySelector'
import { useOrderStore } from '@/store/orderStore'
import { formatUZS } from '@/lib/pricing'
import type { PublicProduct, Product } from '@/types'
import { cn } from '@/lib/validations'

interface ProductCardProps {
  product: Product | PublicProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const { addItem, items } = useOrderStore()

  const isOutOfStock = product.available_stock <= 0
  const inOrder = items.some((i) => i.productId === product.id)
  const unit = product.unit_name || 'Qop'
  const weight = product.weight_per_box || 10
  const sellingPrice = product.selling_price || product.price || 0
  const sku = product.sku || 'PRD'
  const slug = product.slug || sku.toLowerCase()

  function handleAdd() {
    if (isOutOfStock) return

    addItem({
      productId: product.id,
      sku,
      unitName: unit,
      quantity,
      weightPerBox: weight,
      availableStock: product.available_stock,
      imageUrl: product.image_url,
      sellingPrice,
    })

    toast.success(`${sku} buyurtmaga qo‘shildi`)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <article className="card-hover flex flex-col overflow-hidden bg-white border border-border rounded-2xl shadow-xs group">
      {/* Product Image */}
      <Link
        href={`/products/${slug}`}
        className="relative block overflow-hidden bg-ivory-200"
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="aspect-square">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={sku}
              fill
              className={cn(
                'object-cover transition-transform duration-300 group-hover:scale-105',
                isOutOfStock && 'opacity-60 grayscale'
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted gap-1 bg-ivory-100">
              <Package size={36} strokeWidth={1.2} />
              <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-muted/80">
                {sku}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info Body */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 gap-2.5">
        {/* SKU Header */}
        <div>
          <Link href={`/products/${slug}`}>
            <h3 className="font-mono font-black text-charcoal text-sm sm:text-base leading-tight hover:text-olive transition-colors tracking-tight">
              SKU: {sku}
            </h3>
          </Link>
          {product.description && (
            <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
              {product.description}
            </p>
          )}
        </div>

        {/* Packaging Specs */}
        <div className="space-y-0.5 text-xs text-charcoal">
          <p className="font-semibold flex items-center gap-1">
            <span>📦</span>
            <span>{unit}</span>
          </p>
          <p className="text-muted flex items-center gap-1 text-[11px]">
            <span>⚖️</span>
            <span>1 {unit.toLowerCase()} = {weight} kg</span>
          </p>
        </div>

        {/* Price */}
        <div className="pt-1">
          <p className="text-base sm:text-lg font-black text-charcoal">
            💰 {formatUZS(sellingPrice)}
          </p>
        </div>

        {/* Stock Status Pill */}
        <div className="pt-0.5">
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>Tugagan</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>Mavjud: {product.available_stock} {unit.toLowerCase()}</span>
            </span>
          )}
        </div>

        {/* Quantity + Add Button */}
        {!isOutOfStock ? (
          <div className="flex items-center gap-2 mt-auto pt-2">
            <QuantitySelector
              value={quantity}
              min={1}
              max={product.available_stock}
              onChange={setQuantity}
              size="sm"
            />
            <button
              onClick={handleAdd}
              aria-label={`${sku} buyurtmaga qo‘shish`}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5',
                'text-xs font-semibold rounded-xl px-3 py-2.5 transition-all touch-target shadow-xs',
                added
                  ? 'bg-olive-50 text-olive border border-olive-200'
                  : inOrder
                  ? 'bg-charcoal text-white hover:bg-charcoal-700 active:scale-95'
                  : 'bg-olive text-white hover:bg-olive-600 active:scale-95'
              )}
            >
              {added ? (
                <>
                  <Check size={14} />
                  <span>Qo‘shildi</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={14} />
                  <span>Savatga qo‘shish</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="mt-auto pt-2">
            <p className="text-xs text-muted text-center py-2 px-3 bg-ivory-200 rounded-xl font-medium">
              Hozircha omborda yo‘q
            </p>
          </div>
        )}
      </div>
    </article>
  )
}
