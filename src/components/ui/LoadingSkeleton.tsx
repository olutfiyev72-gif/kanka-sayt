export function ProductCardSkeleton() {
  return (
    <div className="card p-0 overflow-hidden animate-pulse">
      {/* Image */}
      <div className="skeleton h-48 w-full rounded-none" />
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-6 w-32" />
        <div className="flex items-center justify-between mt-4">
          <div className="skeleton h-10 w-28" />
          <div className="skeleton h-10 w-28" />
        </div>
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function OrderItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 animate-pulse">
      <div className="skeleton w-12 h-12 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-1/3" />
      </div>
      <div className="skeleton h-8 w-20" />
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="skeleton h-3 w-1/2 mb-3" />
      <div className="skeleton h-8 w-1/3" />
    </div>
  )
}
