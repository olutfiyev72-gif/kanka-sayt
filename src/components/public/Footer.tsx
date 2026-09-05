import Link from 'next/link'
import { Send, Phone, MapPin, Clock, ShieldCheck, Lock } from 'lucide-react'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-charcoal text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Brand */}
          <div className="space-y-3">
            <h2 className="text-2xl font-black tracking-tight text-white">KANKA</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              Ombordagi mavjud mahsulotlarni real vaqtda ko&apos;ring va kerakli miqdorni oldindan band qiling.
            </p>
            <div className="flex items-center gap-2 text-xs text-olive-300 bg-white/5 p-2.5 rounded-xl border border-white/10">
              <ShieldCheck size={16} className="flex-shrink-0 text-olive-400" />
              <span>100% Rasmiy zaxira va kafolatlangan rezervatsiya</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:pl-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">
              Sahifalar
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/', label: 'Bosh sahifa' },
                { href: '/products', label: 'Mahsulotlar katalogi' },
                { href: '/about', label: 'Biz haqimizda' },
                { href: '/contact', label: 'Aloqa' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/80 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">
              Tezkor Aloqa
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="tel:+998910139595"
                  className="flex items-center gap-2 text-sm text-white font-semibold hover:text-olive-300 transition-colors"
                >
                  <Phone size={15} className="text-olive-400" />
                  <span>+998 91 013 95 95</span>
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/otaniyoz_lutfiyev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
                >
                  <Send size={15} className="text-olive-400" />
                  <span>Telegram: @otaniyoz_lutfiyev</span>
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-white/70">
                <MapPin size={15} className="mt-0.5 flex-shrink-0 text-olive-400" />
                <span>Toshkent shahar, KANKA ulgurji markazi</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-white/70">
                <Clock size={15} className="text-olive-400" />
                <span>Har kuni: 08:30–19:00</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {year} KANKA. Barcha huquqlar himoyalangan.</p>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/login"
              className="hover:text-white/80 transition-colors flex items-center gap-1.5 text-[11px]"
            >
              <Lock size={12} className="text-white/60" />
              <span>Xodimlar uchun kirish</span>
            </Link>
            <p className="text-white/30 hidden sm:inline">Warehouse Stock Visibility & Pre-Order Reservation</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
