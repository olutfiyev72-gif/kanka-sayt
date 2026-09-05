import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-8xl font-bold text-charcoal mb-4">404</p>
        <h1 className="text-xl font-semibold text-charcoal mb-2">
          Sahifa topilmadi
        </h1>
        <p className="text-sm text-muted mb-8">
          Kechirasiz, siz qidirayotgan sahifa mavjud emas yoki o&apos;chirib tashlangan.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary">Bosh sahifaga qaytish</Link>
          <Link href="/products" className="btn-secondary">Mahsulotlar</Link>
        </div>
      </div>
    </div>
  )
}
