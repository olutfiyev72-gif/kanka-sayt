import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/types'
import { VALID_TRANSITIONS } from '@/types'

// PATCH /api/orders/[id]/status — Admin: change order status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const newStatus: OrderStatus = body.status

    // Validate new status is a valid value
    const validStatuses: OrderStatus[] = ['NEW', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: 'Noto\'g\'ri status' }, { status: 400 })
    }

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, order_number')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 })
    }

    const currentStatus = order.status as OrderStatus

    // Validate transition
    const allowedNext = VALID_TRANSITIONS[currentStatus]
    if (!allowedNext.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `"${currentStatus}" statusidan "${newStatus}" statusiga o'tish mumkin emas`,
        },
        { status: 400 }
      )
    }

    // ===================================================
    // Handle stock side effects
    // ===================================================
    if (newStatus === 'CANCELLED') {
      // Release reserved stock back to available
      const { error: releaseError } = await supabase.rpc('release_order_stock', {
        p_order_id: id,
      })
      if (releaseError) {
        console.error('[CANCEL STOCK RELEASE]', releaseError)
        throw releaseError
      }
    }

    if (newStatus === 'COMPLETED') {
      // Finalize: remove from reserved and total (goods left warehouse)
      const { error: completeError } = await supabase.rpc('complete_order_stock', {
        p_order_id: id,
      })
      if (completeError) {
        console.error('[COMPLETE STOCK]', completeError)
        throw completeError
      }
    }

    // Update order status
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[PATCH /api/orders/[id]/status]', err)
    return NextResponse.json(
      { error: 'Status o\'zgartirib bo\'lmadi' },
      { status: 500 }
    )
  }
}
