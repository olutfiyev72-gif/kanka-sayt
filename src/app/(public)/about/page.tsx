import type { Metadata } from 'next'
import { MapPin, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Biz haqimizda',
  description: 'KANKA — ombordagi mahsulotlarni oldindan buyurtma qilish imkonini beruvchi platforma.',
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="section-title mb-6">Biz haqimizda</h1>

      <div className="card p-6 md:p-8 mb-8">
        <p className="text-charcoal-600 leading-relaxed mb-4">
          <strong>KANKA</strong> — bu mahsulot sotib oluvchilarning omborga bekorga kelmasligi uchun yaratilgan
          raqamli platforma.
        </p>
        <p className="text-charcoal-600 leading-relaxed mb-4">
          Bizning maqsad — mijozga omborga kelishidan oldin qaysi mahsulot mavjudligini va qancha qoldig&apos;i
          borligini ko&apos;rsatish hamda kerakli mahsulotni oldindan band qilish imkonini berish.
        </p>
        <p className="text-charcoal-600 leading-relaxed">
          Platforma orqali buyurtma bergandan so&apos;ng mahsulot sizning nomingizga zudlik bilan band qilinadi va
          siz omborga kelganingizda tayyor holda kutib turadi.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-olive-50 flex items-center justify-center flex-shrink-0">
            <MapPin size={20} className="text-olive" />
          </div>
          <div>
            <h3 className="font-semibold text-charcoal text-sm mb-1">Manzil</h3>
            <p className="text-sm text-muted">Toshkent shahar</p>
          </div>
        </div>
        <div className="card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-olive-50 flex items-center justify-center flex-shrink-0">
            <Clock size={20} className="text-olive" />
          </div>
          <div>
            <h3 className="font-semibold text-charcoal text-sm mb-1">Ish vaqti</h3>
            <p className="text-sm text-muted">Dushanba–Shanba: 09:00–18:00</p>
          </div>
        </div>
      </div>
    </div>
  )
}
