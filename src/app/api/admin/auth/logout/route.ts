import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '@/lib/adminAuth'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  })
  return response
}
