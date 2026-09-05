'use client'

// ============================================================
// KANKA — Analytics Events
// GA4 + Meta Pixel
// ============================================================

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args)
  }
}

function fbq(event: string, name: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', name, params)
  }
}

// ---------------------------
// Events
// ---------------------------

export function trackPageView(url: string) {
  gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, { page_path: url })
}

export function trackViewProduct(product: { id: string; sku?: string | null; name?: string | null; slug?: string | null }) {
  const label = product.sku || product.name || 'Product'
  gtag('event', 'view_item', {
    items: [{ item_id: product.id, item_name: label }],
  })
  fbq('event', 'ViewContent', { content_ids: [product.id], content_name: label })
}

export function trackAddToOrder(product: { id: string; sku?: string | null; name?: string | null }, quantity: number) {
  const label = product.sku || product.name || 'Product'
  gtag('event', 'add_to_cart', {
    items: [{ item_id: product.id, item_name: label, quantity }],
  })
  fbq('event', 'AddToCart', { content_ids: [product.id], quantity })
}

export function trackRemoveFromOrder(productId: string) {
  gtag('event', 'remove_from_cart', { item_id: productId })
}

export function trackBeginOrder() {
  gtag('event', 'begin_checkout')
  fbq('event', 'InitiateCheckout')
}

export function trackSubmitOrder(orderNumber: string, totalBoxes: number) {
  gtag('event', 'purchase', { transaction_id: orderNumber, items_count: totalBoxes })
  fbq('event', 'Purchase', { order_id: orderNumber })
}

export function trackOrderSuccess(orderNumber: string) {
  gtag('event', 'order_success', { order_number: orderNumber })
}

export function trackTelegramClick() {
  gtag('event', 'telegram_click')
  fbq('event', 'Contact', { method: 'telegram' })
}

export function trackPhoneClick() {
  gtag('event', 'phone_click')
  fbq('event', 'Contact', { method: 'phone' })
}
