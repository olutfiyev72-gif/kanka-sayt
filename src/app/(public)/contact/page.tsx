import type { Metadata } from 'next'
import { ContactLinks } from '@/components/public/ContactLinks'

export const metadata: Metadata = {
  title: 'Aloqa — KANKA Ombori',
  description: 'KANKA ombori bilan bog\'lanish: +998 91 013 95 95, Telegram: @otaniyoz_lutfiyev, manzil Toshkent shahar.',
}

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="text-center mb-8">
        <span className="badge-available inline-block mb-2">🟢 Tezkor aloqa</span>
        <h1 className="section-title">Ombor bilan bog&apos;lanish</h1>
        <p className="section-subtitle">
          Zaxira, buyurtmani olib ketish yoki hamkorlik masalalarida murojaat qiling
        </p>
      </div>
      <ContactLinks />
    </div>
  )
}
