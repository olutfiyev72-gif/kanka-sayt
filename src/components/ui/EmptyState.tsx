import { Package, ShoppingCart, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/validations'

interface EmptyStateProps {
  variant?: 'products' | 'orders' | 'error' | 'generic'
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

const ICONS = {
  products: Package,
  orders: ShoppingCart,
  error: AlertCircle,
  generic: Package,
}

const DEFAULTS = {
  products: {
    title: 'Mahsulotlar yo\'q',
    description: 'Hozircha hech qanday mahsulot qo\'shilmagan.',
  },
  orders: {
    title: 'Buyurtmalar yo\'q',
    description: 'Hali hech qanday buyurtma kelmagan.',
  },
  error: {
    title: 'Xatolik yuz berdi',
    description: 'Ma\'lumotlarni yuklashda muammo bo\'ldi. Sahifani yangilang.',
  },
  generic: {
    title: 'Ma\'lumot topilmadi',
    description: '',
  },
}

export function EmptyState({
  variant = 'generic',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = ICONS[variant]
  const defaults = DEFAULTS[variant]

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="w-16 h-16 rounded-2xl bg-ivory-200 flex items-center justify-center mb-4">
        <Icon size={28} className="text-muted" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-charcoal">
        {title || defaults.title}
      </h3>
      {(description || defaults.description) && (
        <p className="text-sm text-muted mt-1 max-w-xs">
          {description || defaults.description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
