import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendOrderNotification } from '@/lib/telegram'
import { checkoutSchema } from '@/lib/validations'
import { z } from 'zod'
import type { CreateOrderResult } from '@/types'

// Rate limiting: simple in-memory (use Redis/Upstash in production)
const submissionTracker = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 60 * 1000  // 1 minute
const RATE_LIMIT_MAX = 3  // max 3 orders per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = (submissionTracker.get(ip) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW
  )
  
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false
  }
  
  timestamps.push(now)
  submissionTracker.set(ip, timestamps)
  return true
}

// GET /api/orders — Admin: list orders
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    let query = supabase
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'ALL') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({ data, total: count, page, limit })
  } catch (err) {
    console.error('[GET /api/orders]', err)
    return NextResponse.json({ error: 'Buyurtmalarni yuklab bo\'lmadi' }, { status: 500 })
  }
}

// POST /api/orders — Public: create order (ATOMIC)
export async function POST(request: Request) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Juda ko\'p so\'rov. Bir daqiqa kutib qayta urinib ko\'ring.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()

    // Validate customer info
    const customerData = checkoutSchema.safeParse(body)
    if (!customerData.success) {
      return NextResponse.json(
        { error: customerData.error.errors[0]?.message || 'Ma\'lumotlar noto\'g\'ri' },
        { status: 400 }
      )
    }

    // Validate items
    const itemsSchema = z.array(
      z.object({
        product_id: z.string().uuid('Noto\'g\'ri mahsulot ID'),
        quantity_boxes: z.number().int().min(1, 'Miqdor kamida 1 bo\'lishi kerak'),
      })
    ).min(1, 'Kamida bitta mahsulot tanlang')

    const itemsData = itemsSchema.safeParse(body.items)
    if (!itemsData.success) {
      return NextResponse.json(
        { error: itemsData.error.errors[0]?.message || 'Mahsulotlar noto\'g\'ri' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // ===================================================
    // ATOMIC RESERVATION — Call PostgreSQL function
    // This handles all stock checking, locking, and updates
    // ===================================================
    const { data: result, error: fnError } = await supabase.rpc(
      'create_order_atomic',
      {
        p_customer_name: customerData.data.customer_name,
        p_phone: customerData.data.phone,
        p_visit_time: customerData.data.visit_time || null,
        p_note: customerData.data.note || null,
        p_items: JSON.stringify(itemsData.data),
      }
    )

    if (fnError) {
      console.error('[ORDER ATOMIC ERROR]', fnError)
      return NextResponse.json(
        { error: 'Buyurtmani qayta ishlashda xatolik yuz berdi' },
        { status: 500 }
      )
    }

    const orderResult = result as CreateOrderResult & { error?: string; code?: string }

    if (!orderResult.success) {
      // Handle stock insufficiency errors
      const errorMsg = orderResult.error || 'Buyurtmani yaratib bo\'lmadi'
      
      if (orderResult.code === 'P0005') {
        return NextResponse.json(
          { error: errorMsg, code: 'INSUFFICIENT_STOCK' },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    // ===================================================
    // Send Telegram notification (non-blocking)
    // ===================================================
    const items = itemsData.data
    
    // Get product SKU and packaging details for notification
    const productIds = items.map((i) => i.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name, weight_per_box, unit_name, selling_price, price')
      .in('id', productIds)

    const productMap = new Map(products?.map((p) => [p.id, p]) || [])

    sendOrderNotification({
      orderNumber: orderResult.order_number,
      customerName: customerData.data.customer_name,
      phone: customerData.data.phone,
      visitTime: customerData.data.visit_time,
      note: customerData.data.note,
      items: items.map((item) => {
        const prod = productMap.get(item.product_id)
        const price = prod?.selling_price || prod?.price || 0
        return {
          sku: prod?.sku || prod?.name || 'PRD-UNKNOWN',
          packageType: prod?.unit_name || 'qop',
          weightPerBox: prod?.weight_per_box || 10,
          quantityBoxes: item.quantity_boxes,
          unitPrice: price,
        }
      }),
      totalBoxes: orderResult.total_boxes,
      totalWeight: orderResult.total_weight,
      totalRevenue: orderResult.total_revenue,
      createdAt: new Date().toISOString(),
    }).catch((e) => console.error('[Telegram notification failed]', e))

    return NextResponse.json({
      data: {
        order_id: orderResult.order_id,
        order_number: orderResult.order_number,
        total_boxes: orderResult.total_boxes,
        total_weight: orderResult.total_weight,
      },
    }, { status: 201 })

  } catch (err) {
    console.error('[POST /api/orders]', err)
    return NextResponse.json(
      { error: 'Server xatoligi. Iltimos, qayta urinib ko\'ring.' },
      { status: 500 }
    )
  }
}
