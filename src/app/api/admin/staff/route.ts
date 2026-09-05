import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export interface StaffMember {
  id: string
  name: string
  phone: string
  email?: string
  role: 'ADMIN' | 'OMBORCHI' | 'MANAGER'
  can_add_products: boolean
  can_manage_stock: boolean
  can_manage_orders: boolean
  is_active: boolean
  created_at: string
}

const DEFAULT_STAFF: StaffMember[] = [
  {
    id: 'staff-owner-1',
    name: 'Asosiy Administrator (Do\'kon Egasi)',
    phone: '+998 91 013 95 95',
    email: 'admin@kanka.uz',
    role: 'ADMIN',
    can_add_products: true,
    can_manage_stock: true,
    can_manage_orders: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'staff-worker-1',
    name: 'Omborchi (1-smena)',
    phone: '+998 90 123 45 67',
    role: 'OMBORCHI',
    can_add_products: true,
    can_manage_stock: true,
    can_manage_orders: false,
    is_active: true,
    created_at: new Date().toISOString(),
  },
]

// GET /api/admin/staff — List all staff
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'warehouse_staff_members')
      .maybeSingle()

    if (error || !data?.value) {
      return NextResponse.json({ data: DEFAULT_STAFF })
    }

    try {
      const parsed = JSON.parse(data.value)
      return NextResponse.json({ data: parsed })
    } catch {
      return NextResponse.json({ data: DEFAULT_STAFF })
    }
  } catch (err) {
    console.error('[GET /api/admin/staff]', err)
    return NextResponse.json({ data: DEFAULT_STAFF })
  }
}

// POST /api/admin/staff — Save or update full staff list
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const staffList: StaffMember[] = body.staff || []

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'warehouse_staff_members',
          value: JSON.stringify(staffList),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )

    if (error) throw error

    return NextResponse.json({ success: true, data: staffList })
  } catch (err) {
    console.error('[POST /api/admin/staff]', err)
    return NextResponse.json(
      { error: 'Xodimlarni saqlashda xatolik yuz berdi' },
      { status: 500 }
    )
  }
}
