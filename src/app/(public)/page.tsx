import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { ProductCard } from '@/components/public/ProductCard'
import {
  ArrowRight,
  Package,
  CheckCircle,
  Truck,
  Bell,
  Phone,
  ShieldCheck,
  Clock,
  Sparkles,
  Send,
  Lock,
} from 'lucide-react'
import type { Product } from '@/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'KANKA — Ombordagi Mahsulotlar va Real-Vaqt Zaxira Tizimi',
  description:
    'Ombordagi tovarlar mavjudligini real vaqtda ko\'ring, aniq karopka miqdorini band qiling. Aloqa: +998 91 013 95 95.',
}

const HOW_IT_WORKS = [
  { icon: Package, title: 'Mahsulotni tanlang', desc: 'Ombordagi mavjud mahsulotlar va aniq karopka qoldiqlarini ko\'ring.' },
  { icon: CheckCircle, title: 'Miqdorni belgilang', desc: 'Kerakli mahsulot va miqdorni bir zumda buyurtmaga qo\'shing.' },
  { icon: Bell, title: 'Rezervatsiyani yuboring', desc: 'Ism va telefon raqamingiz (+998...) bilan tasdiqlang — zaxira sizga qulflanadi.' },
  { icon: Truck, title: 'Ombordan olib keting', desc: 'Ombor xodimlarimiz buyurtmani tayyorlab qo\'yadi — kelib tekshirib olasiz.' },
]

const FAQ = [
  {
    q: 'Buyurtma bergandan keyin mahsulot kafolatlanganmi?',
    a: 'Ha! Buyurtma tasdiqlanishi bilan PostgreSQL tranzaksiyasi orqali kerakli karopkalar aynan sizning nomingizga band qilinadi va boshqa xaridorlarga sotilmaydi.',
  },
  {
    q: 'Oldindan to\'lov yoki karta kiritish talab qilinadimi?',
    a: 'Yo\'q. Tizimda online to\'lov yo\'q. To\'lov faqat omborga kelib, tovar sifatini o\'z ko\'zingiz bilan ko\'rib, qabul qilganingizda amalga oshiriladi.',
  },
  {
    q: 'Kimlar yangi mahsulot qo\'sha oladi?',
    a: 'Mahsulot kiritish va ombor qoldiqlarini boshqarish do\'kon egasi hamda egasi tomonidan admin/omborchi qilib tayinlangan ishonchli ishchilar uchun ochiq.',
  },
  {
    q: 'Qancha vaqt ichida buyurtmani olib ketishim kerak?',
    a: 'Buyurtma berilgach ombor xodimlarimiz uni 30–60 daqiqada tayyorlaydi. O\'zingizga qulay vaqtni belgilab kelishingiz yoki +998 91 013 95 95 raqamiga xabar berishingiz mumkin.',
  },
]

async function getActiveProducts(): Promise<Product[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .gt('available_stock', 0)
      .order('created_at', { ascending: true })
      .limit(8)
    return (data as Product[]) || []
  } catch {
    return []
  }
}

export default async function HomePage() {
  const featuredProducts = await getActiveProducts()

  return (
    <>
      {/* ===== COMPACT MODERN HERO SECTION ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-ivory to-white border-b border-border py-8 md:py-12">
        {/* Subtle background blur accents */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-olive-100/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-ivory-300/50 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            {/* Live Indicator pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white shadow-xs border border-border mb-4 text-xs font-medium text-charcoal">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="font-semibold text-olive">Jonli Zaxira Nazorati</span>
              <span className="text-muted">·</span>
              <span className="text-muted">Ombor ochiq (08:30–19:00)</span>
            </div>

            {/* Main Headline - Compact & Punchy */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-charcoal tracking-tight leading-tight">
              Ombordagi tovarlarni ko&apos;ring va{' '}
              <span className="text-olive underline decoration-olive-200 decoration-wavy decoration-2">
                oldindan band qiling
              </span>
            </h1>

            <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed max-w-2xl">
              Bekorga kelishlarga chek qo&apos;ying. KANKA omboridagi real karopka qoldiqlarini
              onlayn tekshirib, o&apos;zingizga kerakli miqdorni bir zumda zaxiralang.
            </p>

            {/* Call to Actions Bar - Ultra-Compact & Intuitive */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* Primary Catalog button */}
              <Link href="/products" className="btn-primary py-2.5 px-4 text-sm gap-2 shadow-xs">
                <Package size={17} />
                <span>Mahsulotlar katalogi</span>
                <ArrowRight size={16} />
              </Link>

              {/* Direct Telegram Chat */}
              <a
                href="https://t.me/otaniyoz_lutfiyev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-olive text-white hover:bg-olive-600 transition-all shadow-xs active:scale-95"
              >
                <Send size={15} />
                <span>Telegram: @otaniyoz_lutfiyev</span>
              </a>

              {/* Hotline Call Button */}
              <a
                href="tel:+998910139595"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-white text-charcoal hover:bg-ivory-200 border border-border transition-all active:scale-95"
              >
                <Phone size={15} className="text-olive" />
                <span>+998 91 013 95 95</span>
              </a>

              {/* Staff login shortcut */}
              <Link
                href="/admin/login"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs text-charcoal/80 bg-ivory-100 hover:bg-ivory-200 border border-border transition-all"
                title="Admin yoki Ega sifatida boshqaruv paneliga kirish"
              >
                <Lock size={14} className="text-amber-600" />
                <span>Xodimlar kirishi</span>
              </Link>
            </div>

            {/* Trust Points - Compact Single Line */}
            <div className="mt-6 pt-4 border-t border-border/80 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-charcoal font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={15} className="text-olive flex-shrink-0" />
                <span>100% Aniq qoldiqlar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-olive flex-shrink-0" />
                <span>Online to&apos;lov shart emas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={15} className="text-olive flex-shrink-0" />
                <span>30–60 daqiqada tayyor</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ===== FEATURED PRODUCTS ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-olive font-semibold text-xs tracking-wider uppercase mb-1">
              <Sparkles size={15} />
              <span>Real-vaqt ombor javoni</span>
            </div>
            <h2 className="section-title">Omborda Hozir Mavjud Mahsulotlar</h2>
            <p className="section-subtitle">Zaxiradagi karopkalar soni va har bir qutining vazni (kg)</p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-olive hover:text-charcoal transition-colors group"
          >
            <span>Barcha tovarlarni ko&apos;rish</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 md:gap-5">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center space-y-3 bg-white border border-border">
            <Package size={36} className="mx-auto text-muted" />
            <h3 className="font-semibold text-charcoal">Omborda yangi tovarlar kutilmoqda</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Mahsulotlar tez orada qabul qilinadi. Zaxira va buyurtma haqida ma&apos;lumot olish uchun to&apos;g&apos;ridan-to&apos;g&apos;ri qo&apos;ng&apos;iroq qiling:
            </p>
            <a
              href="tel:+998910139595"
              className="inline-flex items-center gap-2 font-bold text-olive text-sm hover:underline"
            >
              <Phone size={15} />
              +998 91 013 95 95
            </a>
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link href="/products" className="btn-secondary w-full">
            Barcha mahsulotlar katalogi
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="bg-white border-y border-border py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-olive bg-olive-50 px-3 py-1 rounded-full border border-olive-200">
              Oddiy va qulay jarayon
            </span>
            <h2 className="section-title mt-3">Qanday buyurtma beriladi?</h2>
            <p className="section-subtitle">Omborga kelishdan oldin 4 ta oson qadam</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="card p-5 bg-ivory-50/50 hover:bg-white transition-colors relative group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-olive-50 group-hover:bg-olive group-hover:text-white flex items-center justify-center transition-colors">
                      <Icon size={22} className="text-olive group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-xs font-extrabold text-muted-light group-hover:text-charcoal transition-colors">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="font-bold text-charcoal text-base mb-1.5">{step.title}</h3>
                  <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== HOTLINE / DIRECT WAREHOUSE CONTACT BANNER ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card p-8 bg-charcoal text-white rounded-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="inline-block px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-olive text-white">
                Tezkor Bog&apos;lanish
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Savollaringiz yoki katta partiyadagi buyurtmangiz bormi?
              </h2>
              <p className="text-sm text-white/70">
                Ombor mudiriga to&apos;g&apos;ridan-to&apos;g&apos;ri qo&apos;ng&apos;iroq qiling yoki Telegram orqali xabar qoldiring.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="tel:+998910139595"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-white text-charcoal hover:bg-olive-50 hover:text-olive transition-colors shadow-md"
              >
                <Phone size={18} className="text-olive" />
                <span>+998 91 013 95 95</span>
              </a>
              <a
                href="https://t.me/otaniyoz_lutfiyev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm bg-olive text-white hover:bg-olive-600 transition-colors shadow-md"
              >
                <Send size={18} />
                <span>Telegram: @otaniyoz_lutfiyev</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="text-center mb-8">
          <h2 className="section-title">Ko&apos;p beriladigan savollar</h2>
          <p className="section-subtitle">Ombor tizimi bo&apos;yicha muhim ma&apos;lumotlar</p>
        </div>
        <div className="space-y-3.5">
          {FAQ.map((item, i) => (
            <div key={i} className="card p-5 bg-white border border-border">
              <h3 className="font-semibold text-charcoal text-sm flex items-start gap-2">
                <span className="text-olive font-bold">Q:</span>
                <span>{item.q}</span>
              </h3>
              <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed pl-5">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
