import { z } from 'zod'

// ============================================================
// Checkout / Order validation
// ============================================================
export const checkoutSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, 'Ism kamida 2 ta harf bo\'lishi kerak')
    .max(100, 'Ism 100 ta belgidan uzun bo\'lmasin'),
  phone: z
    .string()
    .min(9, 'Telefon raqam noto\'g\'ri')
    .max(25, 'Telefon raqam noto\'g\'ri')
    .regex(
      /^(\+?998|0)?\s*(90|91|93|94|95|97|98|99|33|88|77|20|50)\s*\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/,
      'O\'zbek telefon raqami kiriting (+998 XX XXX XX XX)'
    ),
  visit_time: z.string().optional().nullable(),
  note: z.string().max(500, 'Izoh 500 belgidan qisqa bo\'lsin').optional().nullable(),
})

export type CheckoutFormData = z.infer<typeof checkoutSchema>

// ============================================================
// Admin product validation (SKU / Maxsus belgi is primary identifier)
// ============================================================
export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'SKU / Maxsus belgi kiritilishi shart')
    .max(50, 'SKU 50 ta belgidan oshmasligi kerak'),
  unit_name: z
    .string()
    .trim()
    .min(1, 'Qadoq turi kiritilishi shart')
    .max(50)
    .default('Qop'),
  weight_per_box: z
    .number({ invalid_type_error: '1 qadoq og‘irligini kiriting' })
    .positive('1 qadoq og‘irligi 0 dan katta bo‘lishi kerak'),
  total_stock: z
    .number({ invalid_type_error: 'Qadoqlar sonini kiriting' })
    .int('Qadoqlar soni butun son bo‘lishi kerak')
    .min(0, 'Qadoqlar soni 0 dan kam bo‘lishi mumkin emas')
    .default(0),
  cost_price: z
    .number({ invalid_type_error: 'Tannarxni kiriting' })
    .positive('Tannarx 0 dan katta bo‘lishi kerak'),
  markup_percent: z
    .number()
    .min(0, 'Ustama 0 dan kam bo‘lmasin')
    .default(15),
  selling_price: z.number().min(0).optional().nullable(),
  minimum_stock: z.number().int().min(0).default(5),
  low_stock_threshold: z.number().int().min(0).default(5),
  image_url: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).default('Umumiy'),
  is_active: z.boolean().default(true),
  // Optional / internal helpers for DB backward compatibility
  name: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  price: z.number().min(0).optional().nullable(),
})

export type ProductFormData = z.infer<typeof productSchema>

/** Generate unique SKU (e.g. RICE-001, PRD-102) */
export function generateSKU(prefix: string = 'PRD'): string {
  const clean = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PRD'
  const rand = Math.floor(100 + Math.random() * 900)
  return `${clean}-${rand}`
}


// ============================================================
// Stock adjustment validation
// ============================================================
export const stockAdjustSchema = z.object({
  movement_type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().positive('Miqdor 0 dan katta bo\'lishi kerak'),
  reason: z.string().min(1, 'Sabab kiritish majburiy').max(500),
})

export type StockAdjustFormData = z.infer<typeof stockAdjustSchema>

// ============================================================
// Utility functions
// ============================================================

/** Format phone number for display */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return phone
}

/** Format date to Uzbek locale */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Generate slug from product name */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/** Format weight display */
export function formatWeight(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} tonna`
  return `${kg} kg`
}

/** Class name utility */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
