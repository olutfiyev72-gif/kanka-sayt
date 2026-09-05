import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { ProductCard } from '@/components/public/ProductCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProductGridSkeleton } from '@/components/ui/LoadingSkeleton'
import type { Product } from '@/types'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mahsulotlar',
  description: 'Ombordagi barcha mavjud mahsulotlarni ko\'ring va kerakli miqdorni buyurtma qiling.',
}

async function ProductsGrid() {
  try {
    const supabase = createAdminClient()
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('available_stock', { ascending: false })

    if (error) {
      return (
        <EmptyState
          variant="error"
        description="Mahsulotlarni yuklab bo'lmadi. Sahifani yangilang."
      />
    )
  }

  const items = (products as Product[]) || []
  if (items.length === 0) {
    return (
      <EmptyState
        variant="products"
        description="Hozircha hech qanday mahsulot qo'shilmagan."
      />
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
  } catch {
    return (
      <EmptyState
        variant="error"
        description="Mahsulotlarni yuklab bo'lmadi. Sahifani yangilang."
      />
    )
  }
}

export default function ProductsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-title">Barcha mahsulotlar</h1>
        <p className="section-subtitle">Ombordagi mavjud mahsulotlar ro&apos;yxati</p>
      </div>

      {/* Stock legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        <span className="badge-available">🟢 Mavjud</span>
        <span className="badge-low">🟡 Kam qoldi</span>
        <span className="badge-out">🔴 Mavjud emas</span>
      </div>

      <Suspense fallback={<ProductGridSkeleton count={8} />}>
        <ProductsGrid />
      </Suspense>
    </div>
  )
}
