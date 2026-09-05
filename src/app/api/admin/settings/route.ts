import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ADMIN_COOKIE_NAME,
  verifySessionToken,
  getAuthConfig,
  getMarkupPercent,
  setMarkupPercent,
  updateUserCredentials,
} from '@/lib/adminAuth'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
    const sessionUser = sessionToken ? await verifySessionToken(sessionToken) : null

    if (!sessionUser) {
      return NextResponse.json({ error: 'Avtorizatsiyadan o\'ting' }, { status: 401 })
    }

    const config = await getAuthConfig()
    const markupPercent = await getMarkupPercent()

    const users = config.users.map((u) => ({
      role: u.role,
      login: u.login,
      name: u.name,
      updatedAt: u.updatedAt,
    }))

    return NextResponse.json({
      role: sessionUser.role,
      login: sessionUser.login,
      markupPercent: sessionUser.role === 'OWNER' ? markupPercent : undefined,
      users: sessionUser.role === 'OWNER' ? users : users.filter((u) => u.login === sessionUser.login),
    })
  } catch (err) {
    console.error('[GET /api/admin/settings]', err)
    return NextResponse.json({ error: 'Sozlamalarni yuklab bo\'lmadi' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
    const sessionUser = sessionToken ? await verifySessionToken(sessionToken) : null

    if (!sessionUser) {
      return NextResponse.json({ error: 'Avtorizatsiyadan o\'ting' }, { status: 401 })
    }

    const body = await request.json()

    // 1. Update markup percent (Owner only)
    if (body.markupPercent !== undefined) {
      if (sessionUser.role !== 'OWNER') {
        return NextResponse.json(
          { error: 'Faqat Owner savdo ustamasini (markup) o\'zgartira oladi' },
          { status: 403 }
        )
      }

      const percent = Number(body.markupPercent)
      if (isNaN(percent) || percent < 0 || percent > 1000) {
        return NextResponse.json({ error: 'Foiz 0 dan 1000 gacha bo\'lishi kerak' }, { status: 400 })
      }

      const oldMarkup = await getMarkupPercent()
      const newMarkup = await setMarkupPercent(percent)

      await logAuditEvent({
        action: 'settings_updated',
        actor: sessionUser.login,
        product_name: 'Savdo ustamasi (markup_percent)',
        old_value: { markupPercent: oldMarkup },
        new_value: { markupPercent: newMarkup },
      })
    }

    // 2. Update credentials
    if (body.credentials) {
      const { targetRole, newLogin, newPassword } = body.credentials

      if (!targetRole || !newLogin) {
        return NextResponse.json({ error: 'Role va yangi login ko\'rsatilishi kerak' }, { status: 400 })
      }

      // Permissions: Admin can only change their own admin credentials
      if (sessionUser.role !== 'OWNER' && targetRole === 'OWNER') {
        return NextResponse.json({ error: 'Faqat Owner o\'z ma\'lumotlarini o\'zgartira oladi' }, { status: 403 })
      }

      if (newPassword && newPassword.length < 4) {
        return NextResponse.json({ error: 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak' }, { status: 400 })
      }

      const updated = await updateUserCredentials(targetRole, newLogin, newPassword)

      await logAuditEvent({
        action: 'user_credentials_updated',
        actor: sessionUser.login,
        product_name: `Foydalanuvchi hisobi (${targetRole})`,
        old_value: { targetRole },
        new_value: { targetRole, newLogin: updated.login, passwordChanged: Boolean(newPassword) },
      })
    }

    const updatedConfig = await getAuthConfig()
    const currentMarkup = await getMarkupPercent()

    return NextResponse.json({
      success: true,
      markupPercent: sessionUser.role === 'OWNER' ? currentMarkup : undefined,
      users: updatedConfig.users.map((u) => ({
        role: u.role,
        login: u.login,
        name: u.name,
        updatedAt: u.updatedAt,
      })),
    })
  } catch (err) {
    console.error('[PATCH /api/admin/settings]', err)
    return NextResponse.json({ error: 'Sozlamalarni saqlashda xatolik' }, { status: 500 })
  }
}
