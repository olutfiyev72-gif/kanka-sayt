import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { stockAdjustSchema } from '@/lib/validations'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/adminAuth'
import { logAuditEvent } from '@/lib/auditLog'

// POST /api/stock — Admin: manual stock adjustment
export async function POST(request: Request) {
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

    // Validate
    const parsed = stockAdjustSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Noto\'g\'ri ma\'lumot' },
        { status: 400 }
      )
    }

    const { product_id, movement_type, quantity, reason } = { ...parsed.data, product_id: body.product_id }

    // Get current product stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, available_stock, reserved_stock, total_stock')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Mahsulot topilmadi' }, { status: 404 })
    }

    let newAvailable = product.available_stock
    let newTotal = product.total_stock

    if (movement_type === 'IN') {
      newAvailable = product.available_stock + quantity
      newTotal = product.total_stock + quantity
    } else if (movement_type === 'OUT') {
      if (product.available_stock < quantity) {
        return NextResponse.json(
          { error: `Yetarli stock yo'q. Mavjud: ${product.available_stock}` },
          { status: 400 }
        )
      }
      newAvailable = product.available_stock - quantity
      newTotal = product.total_stock - quantity
    } else if (movement_type === 'ADJUSTMENT') {
      newAvailable = product.available_stock + quantity
      newTotal = product.total_stock + quantity
    }

    // Prevent negative
    if (newAvailable < 0 || newTotal < 0) {
      return NextResponse.json(
        { error: 'Stock manfiy bo\'lishi mumkin emas' },
        { status: 400 }
      )
    }

    // Update product stock
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        available_stock: newAvailable,
        total_stock: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product_id)
      .select()
      .single()

    if (updateError) throw updateError

    // Log movement
    const { error: movementError } = await supabase.from('stock_movements').insert({
      product_id,
      movement_type: movement_type === 'IN' ? 'STOCK_IN' : movement_type === 'OUT' ? 'STOCK_OUT' : 'ADJUSTMENT',
      quantity,
      previous_available: product.available_stock,
      new_available: newAvailable,
      previous_total: product.total_stock,
      new_total: newTotal,
      reason,
      note: reason,
      actor,
    })

    if (movementError) throw movementError

    // Log audit event
    await logAuditEvent({
      actor,
      action: movement_type === 'IN' ? 'stock_added' : 'stock_adjusted',
      product_id: product.id,
      product_name: product.name,
      old_value: { available: product.available_stock, total: product.total_stock },
      new_value: { available: newAvailable, total: newTotal, quantity, movement_type },
    })

    return NextResponse.json({ data: updatedProduct })
  } catch (err) {
    console.error('[POST /api/stock]', err)
    return NextResponse.json({ error: 'Stock o\'zgartirib bo\'lmadi' }, { status: 500 })
  }
}
