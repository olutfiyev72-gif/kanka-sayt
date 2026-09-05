import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  verifyUserCredentials,
  updateUserCredentials,
  verifySessionToken,
  createSessionToken,
  ADMIN_COOKIE_NAME,
} from '@/lib/adminAuth'

export async function POST(request: Request) {
  try {
    const { currentPassword, newLogin, newPassword } = await request.json()

    if (!newLogin || !newPassword) {
      return NextResponse.json(
        { error: 'Yangi login va yangi parolni kiriting' },
        { status: 400 }
      )
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Check if user is already authenticated via cookie
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value
    const sessionUser = sessionToken ? await verifySessionToken(sessionToken) : null

    // Determine target role: if password is Super Admin master password or logged in as OWNER -> OWNER
    let targetRole: 'OWNER' | 'ADMIN' = sessionUser?.role || 'ADMIN'
    if (currentPassword === '910139595') {
      targetRole = 'OWNER'
    }

    // If not authenticated via active session, must provide valid current password
    if (!sessionUser) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Joriy parolni kiriting' },
          { status: 400 }
        )
      }
      if (currentPassword === '910139595') {
        targetRole = 'OWNER'
      } else {
        const verification = await verifyUserCredentials('admin', currentPassword)
        if (!verification.isValid) {
          return NextResponse.json(
            { error: 'Joriy parol noto\'g\'ri' },
            { status: 401 }
          )
        }
      }
    } else if (currentPassword && currentPassword !== '910139595') {
      const verification = await verifyUserCredentials(sessionUser.login, currentPassword)
      if (!verification.isValid) {
        return NextResponse.json(
          { error: 'Joriy parol noto\'g\'ri' },
          { status: 401 }
        )
      }
    }

    // Update credentials
    const updated = await updateUserCredentials(targetRole, newLogin, newPassword)

    // Issue new session token
    const token = await createSessionToken(updated.login, updated.role)
    const response = NextResponse.json({
      success: true,
      message: 'Admin login va paroli muvaffaqiyatli o\'rnatildi',
      login: updated.login,
      role: updated.role,
    })

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })

    return response
  } catch (err) {
    console.error('[POST /api/admin/auth/change-credentials]', err)
    return NextResponse.json(
      { 
        error: 'Sozlamalarni yangilashda xatolik yuz berdi',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
