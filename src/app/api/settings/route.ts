import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { AppSettings } from '@/types'

// GET /api/settings — Public: get non-sensitive settings
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .not('key', 'in', '(telegram_bot_token,telegram_chat_id)')

    if (error) throw error

    const settings: Partial<AppSettings> = {}
    data?.forEach((row) => {
      settings[row.key as keyof AppSettings] = row.value || ''
    })

    return NextResponse.json({ data: settings })
  } catch (err) {
    console.error('[GET /api/settings]', err)
    return NextResponse.json({ error: 'Sozlamalar yuklanmadi' }, { status: 500 })
  }
}

// PATCH /api/settings — Admin: update settings
export async function PATCH(request: Request) {
  try {
    const supabase = createAdminClient()
    const body: Partial<AppSettings> = await request.json()

    // Upsert each setting
    const updates = Object.entries(body).map(([key, value]) => ({
      key,
      value: value || '',
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('app_settings')
      .upsert(updates, { onConflict: 'key' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/settings]', err)
    return NextResponse.json({ error: 'Sozlamalarni saqlash muvaffaqiyatsiz' }, { status: 500 })
  }
}
