'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  BarChart3,
  ShoppingCart,
  Settings,
  LogOut,
  X,
  TrendingUp,
  Users,
  Shield,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/validations'
import toast from 'react-hot-toast'

export interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  exact?: boolean
}

export const OWNER_NAV: NavItem[] = [
  { href: '/admin', icon: LayoutDashboard, label: 'Bosh sahifa', exact: true },
  { href: '/admin/products', icon: Package, label: 'Mahsulotlar' },
  { href: '/admin/orders', icon: ShoppingCart, label: 'Buyurtmalar' },
  { href: '/admin/stock', icon: BarChart3, label: 'Ombor' },
  { href: '/admin/reports', icon: TrendingUp, label: 'Moliya' },
  { href: '/admin/staff', icon: Users, label: 'Xodimlar' },
  { href: '/admin/settings', icon: Settings, label: 'Sozlamalar' },
]

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/products', icon: Package, label: 'Mahsulotlar' },
  { href: '/admin/orders', icon: ShoppingCart, label: 'Buyurtmalar' },
  { href: '/admin/stock', icon: BarChart3, label: 'Ombor' },
]

interface AdminSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onToggleMobile: () => void
}

export function AdminSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onToggleMobile,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [role, setRole] = useState<'OWNER' | 'ADMIN'>('OWNER')
  const [userName, setUserName] = useState<string>('Admin')

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth/me')
        const data = await res.json()
        if (data.authenticated && data.role) {
          setRole(data.role)
          setUserName(data.login || (data.role === 'OWNER' ? 'Super Admin' : 'Admin'))
        }
      } catch {
        // fallback
      }
    }
    checkAuth()
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' })
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    toast.success('Tizimdan chiqildi')
    router.push('/admin/login')
    router.refresh()
  }

  const currentNav = role === 'ADMIN' ? ADMIN_NAV : OWNER_NAV

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const SidebarBody = ({ isMobileDrawer = false }: { isMobileDrawer?: boolean }) => {
    const isIconOnly = collapsed && !isMobileDrawer

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header with Logo and Collapse Toggle */}
        <div
          className={cn(
            'flex items-center justify-between border-b border-border h-14',
            isIconOnly ? 'px-2.5 justify-center' : 'px-4'
          )}
        >
          {!isIconOnly ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <Link
                href={role === 'ADMIN' ? '/admin/products' : '/admin'}
                className="font-black text-charcoal tracking-tight text-base hover:text-olive transition-colors truncate"
              >
                KANKA
              </Link>
              {role === 'OWNER' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-olive-100 text-olive-800 border border-olive-300">
                  <ShieldCheck size={10} />
                  <span>EGA</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  <Shield size={10} />
                  <span>ADMIN</span>
                </span>
              )}
            </div>
          ) : (
            <Link
              href={role === 'ADMIN' ? '/admin/products' : '/admin'}
              className="font-black text-charcoal tracking-tight text-sm"
              title="KANKA"
            >
              K
            </Link>
          )}

          {!isMobileDrawer && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-muted hover:text-charcoal hover:bg-ivory-200 transition-colors"
              title={collapsed ? 'Kengaytirish' : 'Ixchamlashtirish'}
              aria-label={collapsed ? 'Kengaytirish' : 'Ixchamlashtirish'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}

          {isMobileDrawer && (
            <button
              type="button"
              onClick={onToggleMobile}
              className="p-1.5 text-muted hover:text-charcoal"
              aria-label="Yopish"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* User preview if expanded */}
        {!isIconOnly && (
          <div className="px-4 py-2 bg-ivory-50 border-b border-border text-[11px] flex items-center justify-between text-muted">
            <span className="truncate max-w-[130px]" title={userName}>
              👤 {userName}
            </span>
            <span className="font-semibold uppercase tracking-wider text-[9px] text-olive">
              {role === 'OWNER' ? 'Super Admin' : 'Admin'}
            </span>
          </div>
        )}

        {/* Navigation items */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto" aria-label="Boshqaruv menyusi">
          {currentNav.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (isMobileDrawer) onToggleMobile()
                }}
                className={cn(
                  'flex items-center rounded-lg text-xs font-medium transition-all group relative',
                  isIconOnly ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2',
                  active
                    ? 'bg-charcoal text-white shadow-xs font-semibold'
                    : 'text-muted hover:bg-ivory-200 hover:text-charcoal'
                )}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={17} className={cn('flex-shrink-0', active ? 'text-white' : 'text-muted group-hover:text-charcoal')} />
                {!isIconOnly && <span className="truncate">{item.label}</span>}

                {/* Tooltip on collapsed desktop view */}
                {isIconOnly && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-charcoal text-white text-[11px] rounded shadow-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer / Actions */}
        <div className={cn('border-t border-border p-2 space-y-1', isIconOnly && 'flex flex-col items-center')}>
          <Link
            href="/"
            target="_blank"
            className={cn(
              'flex items-center rounded-lg text-xs text-muted hover:text-charcoal hover:bg-ivory-100 transition-colors',
              isIconOnly ? 'justify-center p-2' : 'gap-2 px-3 py-2'
            )}
            title="Ommaviy do'konni ko'rish"
            aria-label="Ommaviy do'konni ko'rish"
          >
            <span className="text-sm">↗</span>
            {!isIconOnly && <span className="truncate text-[11px]">Saytga o‘tish</span>}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={cn(
              'flex items-center rounded-lg text-xs text-muted hover:bg-red-50 hover:text-red-600 transition-colors w-full',
              isIconOnly ? 'justify-center p-2' : 'gap-2 px-3 py-2'
            )}
            title="Tizimdan chiqish"
            aria-label="Tizimdan chiqish"
          >
            <LogOut size={16} />
            {!isIconOnly && <span className="truncate">{loggingOut ? 'Chiqilmoqda...' : 'Chiqish'}</span>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-border fixed inset-y-0 left-0 z-30 transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        <SidebarBody />
      </aside>

      {/* Mobile Drawer (Modal slide-out) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fadeIn" onClick={onToggleMobile} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white z-50 flex flex-col shadow-2xl animate-slideRight">
            <SidebarBody isMobileDrawer />
          </aside>
        </div>
      )}
    </>
  )
}
