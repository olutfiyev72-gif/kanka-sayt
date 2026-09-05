import { NextResponse } from 'next/server'
import {
  verifyUserCredentials,
  createSessionToken,
  ADMIN_COOKIE_NAME,
} from '@/lib/adminAuth'

export async function POST(request: Request) {
  try {
    const { email, login, password } = await request.json()
    const username = (login || email || '').trim()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Login va parolni kiriting' },
        { status: 400 }
      )
    }

    const { isValid, user, error: authError } = await verifyUserCredentials(username, password)
    if (!isValid || !user) {
      return NextResponse.json(
        { error: authError || 'Login yoki parol noto\'g\'ri' },
        { status: 401 }
      )
    }

    const token = await createSessionToken(user.login, user.role)
    const response = NextResponse.json({
      success: true,
      user: { login: user.login, role: user.role, name: user.name },
    })

    // Set secure HTTP-only session cookie
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return response
  } catch (err) {
    console.error('[POST /api/admin/auth/login]', err)
    return NextResponse.json(
      { error: 'Kirish paytida xatolik yuz berdi' },
      { status: 500 }
    )
  }
}
