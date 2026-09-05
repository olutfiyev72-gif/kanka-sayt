'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBag, Send, Menu, X, Phone, Lock } from 'lucide-react'
import { useState } from 'react'
import { useOrderStore } from '@/store/orderStore'
import { cn } from '@/lib/validations'

const NAV_LINKS = [
  { href: '/', label: 'Bosh sahifa' },
  { href: '/products', label: 'Mahsulotlar' },
  { href: '/about', label: 'Biz haqimizda' },
  { href: '/contact', label: 'Aloqa' },
]

export function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const totalBoxes = useOrderStore((s) => s.getTotalBoxes())
  const itemCount = useOrderStore((s) => s.getItemCount())

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border shadow-xs">
      {/* Top micro-bar with Hotline & Staff access */}
      <div className="bg-charcoal text-white text-xs py-1.5 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/80">KANKA Ombordagi zaxira tizimi</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/admin/login"
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors text-[11px] font-semibold"
            title="Xodimlar uchun kirish"
          >
            <Lock size={12} className="text-amber-400" />
            <span>Xodimlar kirishi</span>
          </Link>
          <a
            href="tel:+998910139595"
            className="flex items-center gap-1 text-white hover:text-olive-200 transition-colors font-medium text-[11px] sm:text-xs"
          >
            <Phone size={12} />
            <span>+998 91 013 95 95</span>
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
            aria-label="KANKA bosh sahifa"
          >
            <span className="text-2xl font-extrabold tracking-tight text-charcoal group-hover:text-olive transition-colors">
              KANKA
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest bg-olive-50 text-olive px-2 py-0.5 rounded border border-olive-200 hidden sm:inline-block">
              Ombor zaxirasi
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Asosiy menyu">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'text-charcoal font-semibold'
                    : 'text-muted hover:text-charcoal'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Telegram direct link */}
            <a
              href="https://t.me/otaniyoz_lutfiyev"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 text-sm font-medium text-muted hover:text-olive transition-colors px-2 py-1.5"
              aria-label="Telegram: @otaniyoz_lutfiyev"
            >
              <Send size={15} />
              <span>@otaniyoz_lutfiyev</span>
            </a>

            {/* Staff access */}
            <Link
              href="/admin/login"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-charcoal bg-ivory-100 hover:bg-ivory-200 border border-border transition-all"
              title="Xodimlar kirishi"
            >
              <Lock size={13} className="text-olive" />
              <span>Xodimlar</span>
            </Link>

            {/* Order button */}
            <Link
              href="/checkout"
              className={cn(
                'relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all shadow-xs',
                itemCount > 0
                  ? 'bg-charcoal text-white hover:bg-charcoal-700 active:scale-95'
                  : 'bg-ivory-200 text-muted hover:bg-ivory-300'
              )}
              aria-label={`Mening buyurtmam — ${totalBoxes} karopka`}
            >
              <ShoppingBag size={17} />
              <span className="hidden sm:inline">
                {itemCount > 0 ? `${totalBoxes} karopka` : 'Savatcha'}
              </span>
              {itemCount > 0 && (
                <span className="badge-new absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] text-[10px] flex items-center justify-center p-0.5">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 text-muted hover:text-charcoal focus:outline-none"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav
          className="md:hidden border-t border-border bg-white animate-fadeIn"
          aria-label="Mobil menyu"
        >
          <div className="px-4 py-3 space-y-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-ivory-200 text-charcoal font-semibold'
                    : 'text-muted hover:bg-ivory-100 hover:text-charcoal'
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-2 border-t border-border flex flex-col gap-2">
              <a
                href="tel:+998910139595"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-charcoal hover:text-olive"
              >
                <Phone size={16} className="text-olive" />
                <span>+998 91 013 95 95</span>
              </a>
              <a
                href="https://t.me/otaniyoz_lutfiyev"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-olive"
                onClick={() => setMenuOpen(false)}
              >
                <Send size={16} className="text-olive" />
                <span>Telegram: @otaniyoz_lutfiyev</span>
              </a>
              <Link
                href="/admin/login"
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted hover:text-charcoal bg-ivory-100 rounded-lg mt-1"
                onClick={() => setMenuOpen(false)}
              >
                <Lock size={14} className="text-charcoal" />
                <span>Xodimlar uchun kirish</span>
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
