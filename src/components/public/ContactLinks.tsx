'use client'

import { Phone, Send, MapPin } from 'lucide-react'
import { trackPhoneClick, trackTelegramClick } from '@/lib/analytics'

export function ContactLinks() {
  return (
    <div className="space-y-4">
      <a
        href="tel:+998910139595"
        onClick={() => trackPhoneClick()}
        className="card p-5 flex items-center gap-4 hover:shadow-card-hover transition-shadow cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-xl bg-olive-50 flex items-center justify-center flex-shrink-0 group-hover:bg-olive group-hover:text-white transition-colors">
          <Phone size={22} className="text-olive group-hover:text-white transition-colors" />
        </div>
        <div>
          <p className="font-semibold text-charcoal">To&apos;g&apos;ridan-to&apos;g&apos;ri telefon / Tezkor aloqa</p>
          <p className="text-muted text-sm font-medium text-olive mt-0.5">+998 91 013 95 95</p>
          <p className="text-xs text-muted">Ombor mudiri va buyurtmalar bo&apos;yicha</p>
        </div>
      </a>

      <a
        href="https://t.me/otaniyoz_lutfiyev"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackTelegramClick()}
        className="card p-5 flex items-center gap-4 hover:shadow-card-hover transition-shadow cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-xl bg-olive-50 flex items-center justify-center flex-shrink-0 group-hover:bg-olive group-hover:text-white transition-colors">
          <Send size={22} className="text-olive group-hover:text-white transition-colors" />
        </div>
        <div>
          <p className="font-semibold text-charcoal">Telegram orqali bog&apos;lanish</p>
          <p className="text-muted text-sm font-semibold text-olive">@otaniyoz_lutfiyev</p>
          <p className="text-xs text-muted">To&apos;g&apos;ridan-to&apos;g&apos;ri lichkaga yozish</p>
        </div>
      </a>

      <div className="card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-olive-50 flex items-center justify-center flex-shrink-0">
          <MapPin size={22} className="text-olive" />
        </div>
        <div>
          <p className="font-semibold text-charcoal">Ombor manzili</p>
          <p className="text-muted text-sm">Toshkent shahar, KANKA ulgurji markazi</p>
          <p className="text-xs text-muted">Dushanba–Shanba: 08:30–19:00</p>
        </div>
      </div>
    </div>
  )
}
