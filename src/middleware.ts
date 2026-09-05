import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/sessionToken'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isAdminRoute = pathname.startsWith('/admin')
  const isReportsApi = pathname.startsWith('/api/admin/reports')

  // Super-fast path: public routes bypass admin auth checks entirely!
  if (!isAdminRoute && !isReportsApi) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  // 1. Check custom admin session cookie (in-memory HMAC verification, < 1ms)
  const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  let sessionUser: { login: string; role: 'OWNER' | 'ADMIN' } | null = null

  if (adminCookie) {
    sessionUser = await verifySessionToken(adminCookie)
  }

  // 2. Check Supabase auth as optional secondary provider for admin
  let hasSupabaseUser = false
  if (!sessionUser) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && !supabaseUrl.includes('placeholder') && !supabaseUrl.includes('your-project')) {
        const supabase = createServerClient(supabaseUrl, supabaseKey || '', {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value)
              )
              supabaseResponse = NextResponse.next({ request })
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              )
            },
          },
        })

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          hasSupabaseUser = true
          sessionUser = { login: user.email || 'admin', role: 'OWNER' }
        }
      }
    } catch {
      // Ignore Supabase connection error
    }
  }

  const isAuthenticated = Boolean(sessionUser || hasSupabaseUser)
  const isAdminLogin = pathname === '/admin/login'
  const isReportsRoute = pathname.startsWith('/admin/reports')

  // Owner-only route protection: Reports page and Reports API
  if (isReportsRoute || isReportsApi) {
    if (!isAuthenticated) {
      if (isReportsApi) {
        return NextResponse.json({ error: 'Avtorizatsiyadan o\'tilmagan' }, { status: 401 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    if (sessionUser?.role !== 'OWNER') {
      if (isReportsApi) {
        return NextResponse.json(
          { error: 'Ruxsat yo\'q: Ushbu hisobotlar faqat do\'kon egasi (OWNER) uchun ochiq.' },
          { status: 403 }
        )
      }
      const url = request.nextUrl.clone()
      url.pathname = '/admin/products'
      return NextResponse.redirect(url)
    }
  }

  // Protect all /admin/* routes except /admin/login
  if (isAdminRoute && !isAdminLogin && !isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // If already logged in, redirect away from login page to /admin
  if (isAdminLogin && isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
