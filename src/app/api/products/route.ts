import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { verifySessionToken, ADMIN_COOKIE_NAME, getMarkupPercent } from '@/lib/adminAuth'
import { calculateSellingPrice } from '@/lib/pricing'
import { logAuditEvent } from '@/lib/auditLog'
import { generateSlug } from '@/lib/validations'
import type { Product, PublicProduct } from '@/types'

// GET /api/products — Public product listing (active only, CLIENT SAFE)
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) throw error

    // CLIENT DATA SECURITY: Strictly strip cost_price from public responses!
    const sanitized: PublicProduct[] = ((data as Product[]) || []).map((product) => {
      const publicSafe = { ...product }
      delete (publicSafe as Record<string, unknown>).cost_price
      return {
        ...publicSafe,
        selling_price: publicSafe.selling_price || publicSafe.price || 0,
        price: publicSafe.selling_price || publicSafe.price || 0,
      }
    })

    return NextResponse.json({ data: sanitized })
  } catch (err) {
    console.error('[GET /api/products]', err)
    return NextResponse.json({ error: 'Mahsulotlarni yuklab bo\'lmadi' }, { status: 500 })
  }
}

// POST /api/products — Admin & Owner: create product
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
    const authHeader = request.headers.get('Authorization')

    let actor = 'Admin'
    let authorized = false

    if (sessionToken) {
      const session = await verifySessionToken(sessionToken)
      if (session) {
        authorized = true
        actor = `${session.role} (${session.login})`
      }
    } else if (authHeader) {
      authorized = true
      actor = 'API Admin'
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Ruxsat yo\'q: Tizimga kiring' }, { status: 401 })
    }

    const body = await request.json()

    const rawSku = body.sku?.trim()
    if (!rawSku) {
      return NextResponse.json({ error: 'SKU / Maxsus belgi kiritilishi shart' }, { status: 400 })
    }
    const sku = rawSku.toUpperCase()
    const slug = generateSlug(sku) || sku.toLowerCase()

    const costPrice = Math.max(0, Number(body.cost_price || 0))
    if (costPrice <= 0) {
      return NextResponse.json({ error: 'Tannarx 0 dan katta bo\'lishi kerak' }, { status: 400 })
    }

    const totalStock = Math.max(0, Number(body.total_stock || 0))
    const minimumStock = Math.max(0, Number(body.minimum_stock ?? body.low_stock_threshold ?? 5))

    // Automatic markup calculation
    const defaultMarkup = await getMarkupPercent()
    const markupPercent = body.markup_percent !== undefined && Number(body.markup_percent) >= 0
      ? Number(body.markup_percent)
      : defaultMarkup
    const calculatedSellingPrice = calculateSellingPrice(costPrice, markupPercent)

    const supabase = createAdminClient()

    // Check SKU duplicate
    const { data: existingSku } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .maybeSingle()

    if (existingSku) {
      return NextResponse.json(
        { error: 'Bu SKU allaqachon mavjud.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: sku, // Keep DB NOT NULL satisfied
        slug,
        sku,
        category: body.category?.trim() || 'Umumiy',
        description: body.description || null,
        image_url: body.image_url || null, // Optional image
        gallery_urls: body.gallery_urls || [],
        weight_per_box: Number(body.weight_per_box) || 10,
        unit_name: body.unit_name || 'Qop',
        cost_price: costPrice,
        selling_price: calculatedSellingPrice,
        price: calculatedSellingPrice,
        total_stock: totalStock,
        available_stock: totalStock,
        reserved_stock: 0,
        minimum_stock: minimumStock,
        low_stock_threshold: minimumStock,
        is_active: body.is_active ?? true,
        seo_title: body.seo_title || null,
        seo_description: body.seo_description || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Bu SKU allaqachon mavjud.' },
          { status: 400 }
        )
      }
      throw error
    }

    // Log initial stock movement if stock > 0
    if (totalStock > 0) {
      await supabase.from('stock_movements').insert({
        product_id: data.id,
        movement_type: 'INITIAL_STOCK',
        quantity: totalStock,
        previous_available: 0,
        new_available: totalStock,
        previous_total: 0,
        new_total: totalStock,
        reason: 'Boshlang\'ich stock kiritildi',
        note: `Boshlang'ich stock: ${totalStock} ${data.unit_name}`,
        actor,
      })
    }

    // Record audit event
    await logAuditEvent({
      actor,
      action: 'product_created',
      product_id: data.id,
      product_name: data.name,
      new_value: {
        name: data.name,
        sku: data.sku,
        cost_price: data.cost_price,
        selling_price: data.selling_price,
        total_stock: data.total_stock,
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/products]', err)
    return NextResponse.json({ error: 'Mahsulot yaratib bo\'lmadi' }, { status: 500 })
  }
}
