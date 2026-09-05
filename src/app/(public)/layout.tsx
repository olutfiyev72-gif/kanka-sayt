import { Header } from '@/components/public/Header'
import { Footer } from '@/components/public/Footer'
import { StickyOrderCTA } from '@/components/public/StickyOrderCTA'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <Footer />
      <StickyOrderCTA />
    </div>
  )
}
