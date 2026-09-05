import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { verifySessionToken, ADMIN_COOKIE_NAME, getMarkupPercent } from '@/lib/adminAuth'
import { calculateSellingPrice } from '@/lib/pricing'
import { logAuditEvent } from '@/lib/auditLog'
import { generateSlug } from '@/lib/validations'

// GET /api/products/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Mahsulot topilmadi' }, { status: 404 })
    }

    // Check if requester is Admin/Owner
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
    let isInternal = false
    if (sessionToken) {
      const session = await verifySessionToken(sessionToken)
      if (session) isInternal = true
    }

    // If client, sanitize out cost_price
    if (!isInternal) {
      const publicSafe = { ...data }
      delete (publicSafe as Record<string, unknown>).cost_price
      return NextResponse.json({
        data: {
          ...publicSafe,
          selling_price: publicSafe.selling_price || publicSafe.price || 0,
        },
      })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/products/[id]]', err)
    return NextResponse.json({ error: 'Xatolik yuz berdi' }, { status: 500 })
  }
}

// PATCH /api/products/[id] — Admin & Owner: update product
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
    let actor = 'Admin'

    if (sessionToken) {
      const session = await verifySessionToken(sessionToken)
      if (session) {
        actor = `${session.role} (${session.login})`
      } else {
        return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 401 })
      }
    } else {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const body = await request.json()

    // Fetch existing product for audit comparison
    const { data: oldProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !oldProduct) {
      return NextResponse.json({ error: 'Mahsulot topilmadi' }, { status: 404 })
    }

    // Disallow direct stock manipulation through this endpoint
    const safeBody = { ...body }
    delete safeBody.total_stock
    delete safeBody.available_stock
    delete safeBody.reserved_stock

    // Handle SKU update and duplicate prevention
    if (safeBody.sku !== undefined) {
      const cleanSku = safeBody.sku?.trim().toUpperCase()
      if (!cleanSku) {
        return NextResponse.json({ error: 'SKU / Maxsus belgi kiritilishi shart' }, { status: 400 })
      }

      const { data: existingSku } = await supabase
        .from('products')
        .select('id')
        .eq('sku', cleanSku)
        .neq('id', id)
        .maybeSingle()

      if (existingSku) {
        return NextResponse.json({ error: 'Bu SKU allaqachon mavjud.' }, { status: 400 })
      }

      safeBody.sku = cleanSku
      safeBody.name = cleanSku
      safeBody.slug = generateSlug(cleanSku) || cleanSku.toLowerCase()
    }

    // Handle cost_price and automatic markup
    if (safeBody.cost_price !== undefined) {
      const newCost = Math.max(0, Number(safeBody.cost_price))
      safeBody.cost_price = newCost

      const defaultMarkup = await getMarkupPercent()
      const markupPercent = safeBody.markup_percent !== undefined && Number(safeBody.markup_percent) >= 0
        ? Number(safeBody.markup_percent)
        : defaultMarkup
      const newSellingPrice = calculateSellingPrice(newCost, markupPercent)
      safeBody.selling_price = newSellingPrice
      safeBody.price = newSellingPrice
    }

    if (safeBody.minimum_stock !== undefined) {
      safeBody.low_stock_threshold = safeBody.minimum_stock
    }

    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update({ ...safeBody, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Log specific audit events
    if (oldProduct.cost_price !== updatedProduct.cost_price) {
      await logAuditEvent({
        actor,
        action: 'cost_changed',
        product_id: id,
        product_name: updatedProduct.name,
        old_value: { cost_price: oldProduct.cost_price, selling_price: oldProduct.selling_price },
        new_value: { cost_price: updatedProduct.cost_price, selling_price: updatedProduct.selling_price },
      })
    }

    if (oldProduct.is_active !== updatedProduct.is_active) {
      await logAuditEvent({
        actor,
        action: updatedProduct.is_active ? 'product_activated' : 'product_deactivated',
        product_id: id,
        product_name: updatedProduct.name,
        old_value: { is_active: oldProduct.is_active },
        new_value: { is_active: updatedProduct.is_active },
      })
    }

    await logAuditEvent({
      actor,
      action: 'product_updated',
      product_id: id,
      product_name: updatedProduct.name,
      new_value: safeBody,
    })

    return NextResponse.json({ data: updatedProduct })
  } catch (err) {
    console.error('[PATCH /api/products/[id]]', err)
    return NextResponse.json({ error: 'Mahsulotni yangilab bo\'lmadi' }, { status: 500 })
  }
}

// DELETE /api/products/[id] — Admin: archive or delete product
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
    let actor = 'Admin'

    if (sessionToken) {
      const session = await verifySessionToken(sessionToken)
      if (session) {
        actor = `${session.role} (${session.login})`
      } else {
        return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 401 })
      }
    } else {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Check if product has reserved stock
    const { data: product } = await supabase
      .from('products')
      .select('reserved_stock, name')
      .eq('id', id)
      .single()

    if (product && product.reserved_stock > 0) {
      return NextResponse.json(
        { error: `"${product.name}" mahsulotida band qilingan stock bor. Avval buyurtmalarni yakunlang.` },
        { status: 400 }
      )
    }

    // Check if product is referenced in order_items
    const { count: orderItemCount } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)

    if (orderItemCount && orderItemCount > 0) {
      // Soft-delete / archive to preserve historical orders
      const { error: archiveError } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (archiveError) throw archiveError

      await logAuditEvent({
        actor,
        action: 'product_deactivated',
        product_id: id,
        product_name: product?.name,
        new_value: { archived: true },
      })

      return NextResponse.json({
        success: true,
        archived: true,
        message: 'Mahsulot buyurtmalar tarixida mavjud bo\'lgani uchun arxivlandi (nofaol qilindi).',
      })
    }

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    await logAuditEvent({
      actor,
      action: 'product_deactivated',
      product_id: id,
      product_name: product?.name,
      new_value: { deleted: true },
    })

    return NextResponse.json({ success: true, message: 'Mahsulot butunlay o\'chirildi.' })
  } catch (err) {
    console.error('[DELETE /api/products/[id]]', err)
    return NextResponse.json({ error: 'Mahsulotni o\'chirib bo\'lmadi' }, { status: 500 })
  }
}
