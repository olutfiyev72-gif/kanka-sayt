'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  TrendingUp,
  Menu,
  MoreHorizontal,
} from 'lucide-react'
import { AdminSidebar } from './AdminSidebar'
import { cn } from '@/lib/validations'

const SIDEBAR_COLLAPSED_KEY = 'kanka_sidebar_collapsed'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [role, setRole] = useState<'OWNER' | 'ADMIN'>('OWNER')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (saved === 'true') setCollapsed(true)
    } catch {
      // ignore
    }

    async function checkRole() {
      try {
        const res = await fetch('/api/admin/auth/me')
        const data = await res.json()
        if (data.role) setRole(data.role)
      } catch {
        // ignore
      }
    }
    checkRole()
  }, [])

  function handleToggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Mobile bottom navigation items (top 4-5 priority)
  const bottomNavItems = [
    {
      href: role === 'ADMIN' ? '/admin/products' : '/admin',
      icon: LayoutDashboard,
      label: 'Bosh sahifa',
      exact: true,
    },
    { href: '/admin/products', icon: Package, label: 'Mahsulot' },
    { href: '/admin/orders', icon: ShoppingCart, label: 'Buyurtma' },
    { href: '/admin/stock', icon: BarChart3, label: 'Ombor' },
    ...(role === 'OWNER'
      ? [{ href: '/admin/reports', icon: TrendingUp, label: 'Moliya' }]
      : []),
  ]

  function isBottomActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-ivory">
      {/* Sidebar Component */}
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(!mobileOpen)}
      />

      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 inset-x-0 h-13 bg-white/95 backdrop-blur-sm border-b border-border z-20 flex items-center justify-between px-4">
        <Link
          href={role === 'ADMIN' ? '/admin/products' : '/admin'}
          className="font-black text-charcoal tracking-tight text-sm flex items-center gap-1.5"
        >
          <span>KANKA</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-olive-100 text-olive-800">
            {role === 'OWNER' ? 'EGA' : 'ADMIN'}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-muted hover:text-charcoal hover:bg-ivory-100 transition-colors"
          aria-label="Menyuni ochish"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Main Content Area */}
      <main
        className={cn(
          'transition-[margin] duration-200 ease-in-out',
          collapsed ? 'md:ml-16' : 'md:ml-56',
          'pt-14 pb-20 md:pt-0 md:pb-8'
        )}
      >
        <div className="p-3 sm:p-5 md:p-6 lg:p-7 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-white/95 backdrop-blur-md border-t border-border z-30 flex items-center justify-around px-1 shadow-lg"
        aria-label="Mobil pastki navigatsiya"
      >
        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const active = isBottomActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-1 transition-colors relative',
                active ? 'text-charcoal font-bold' : 'text-muted hover:text-charcoal'
              )}
            >
              <Icon size={18} className={cn(active ? 'text-olive scale-105' : 'text-muted')} />
              <span className="text-[10px] mt-0.5 leading-tight">{item.label}</span>
              {active && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-olive" />}
            </Link>
          )
        })}

        {/* More / Menu trigger in bottom bar */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 text-muted hover:text-charcoal transition-colors"
          aria-label="Barcha bo'limlar"
        >
          <MoreHorizontal size={18} />
          <span className="text-[10px] mt-0.5 leading-tight">Ko‘proq</span>
        </button>
      </nav>
    </div>
  )
}
