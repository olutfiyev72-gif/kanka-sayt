import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/server'
import { StockBadge } from '@/components/ui/StockBadge'
import { ProductDetailActions } from './ProductDetailActions'
import type { Product } from '@/types'

interface Props {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('products')
    .select('sku, name, seo_title, seo_description, image_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: 'Mahsulot topilmadi' }

  const displaySku = data.sku || data.name || 'Mahsulot'
  return {
    title: `SKU: ${displaySku}`,
    description: data.seo_description || `SKU: ${displaySku} — KANKA omborida mavjud mahsulot.`,
    openGraph: {
      title: `SKU: ${displaySku}`,
      images: data.image_url ? [data.image_url] : [],
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!product) notFound()

  const p = product as Product
  const sku = p.sku || p.name || 'PRD'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* Image */}
        <div className="relative aspect-square bg-ivory-200 rounded-2xl overflow-hidden">
          {p.image_url ? (
            <Image
              src={p.image_url}
              alt={sku}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-light text-5xl">
              📦
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-mono font-black text-charcoal leading-tight">
              SKU: {sku}
            </h1>
            <p className="text-sm text-muted mt-2">
              📦 {p.unit_name || 'Qop'} • ⚖️ 1 {p.unit_name || 'qop'} = {p.weight_per_box} kg
            </p>
          </div>

          {/* Stock — most prominent info */}
          <div className="bg-ivory-100 rounded-xl p-4 border border-border">
            <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">Hozirgi holat</p>
            <StockBadge
              availableStock={p.available_stock}
              lowStockThreshold={p.low_stock_threshold}
              unitName={p.unit_name}
            />
            {p.available_stock > 0 && (
              <p className="text-xs text-muted mt-2">
                Jami omborda: {p.total_stock} {p.unit_name} •
                Band qilingan: {p.reserved_stock} {p.unit_name}
              </p>
            )}
          </div>

          {/* Description */}
          {p.description && (
            <div>
              <p className="text-sm text-charcoal-600 leading-relaxed">{p.description}</p>
            </div>
          )}

          {/* Add to order (client component) */}
          <ProductDetailActions product={p} />
        </div>
      </div>
    </div>
  )
}
