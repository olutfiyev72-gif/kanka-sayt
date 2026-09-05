import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kanka.uz'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'KANKA — Ombor Mahsulotlari',
    template: '%s | KANKA',
  },
  description:
    'Ombordagi mavjud mahsulotlarni real vaqtda ko\'ring va kerakli mahsulotni oldindan buyurtma qilib qo\'ying.',
  keywords: ['ombor', 'buyurtma', 'mahsulot', 'kanka', 'rezerv'],
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    url: APP_URL,
    siteName: 'KANKA',
    title: 'KANKA — Ombor Mahsulotlari',
    description:
      'Ombordagi mavjud mahsulotlarni real vaqtda ko\'ring va kerakli mahsulotni oldindan buyurtma qilib qo\'ying.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID

  return (
    <html lang="uz">
      <head>
        {/* Google Analytics */}
        {gaId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}');
                `,
              }}
            />
          </>
        )}
        {/* Meta Pixel */}
        {pixelId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
                (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${pixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
        )}
      </head>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1A1A1A',
              color: '#FFFFFF',
              fontSize: '14px',
              borderRadius: '8px',
              padding: '12px 16px',
            },
            success: {
              iconTheme: { primary: '#4A5C3F', secondary: '#FFFFFF' },
            },
            error: {
              iconTheme: { primary: '#DC2626', secondary: '#FFFFFF' },
            },
          }}
        />
      </body>
    </html>
  )
}
