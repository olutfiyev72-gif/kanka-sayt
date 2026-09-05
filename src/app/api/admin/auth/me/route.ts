import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/adminAuth'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false, login: null, role: null })
    }

    const session = await verifySessionToken(sessionToken)
    if (!session) {
      return NextResponse.json({ authenticated: false, login: null, role: null })
    }

    return NextResponse.json({
      authenticated: true,
      login: session.login,
      role: session.role,
    })
  } catch {
    return NextResponse.json({ authenticated: false, login: null, role: null })
  }
}
