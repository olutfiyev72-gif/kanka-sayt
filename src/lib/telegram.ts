// ============================================================
// KANKA — Telegram Bot Notifications (Server-side ONLY)
// Never import this in client components!
// ============================================================

export interface TelegramOrderItem {
  sku: string
  packageType?: string
  weightPerBox?: number
  quantityBoxes: number
  unitPrice?: number
}

export interface TelegramOrderNotification {
  orderNumber: string
  customerName: string
  phone: string
  visitTime?: string | null
  note?: string | null
  items: TelegramOrderItem[]
  totalBoxes: number
  totalWeight: number
  totalRevenue?: number
  createdAt: string
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
}

export function escapeCode(text: string): string {
  return text.replace(/[`\\]/g, '\\$&')
}

function formatNum(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function formatTelegramMessage(data: TelegramOrderNotification): string {
  const isMultiItem = data.items.length > 1

  const itemLines = data.items
    .map((item, idx) => {
      const pType = item.packageType || 'qop'
      const weight = item.weightPerBox || 10
      const totalItemWeight = item.quantityBoxes * weight
      const price = item.unitPrice || 0
      const subtotal = price * item.quantityBoxes

      let block = ''
      if (isMultiItem) {
        block += `${idx + 1}\\. *SKU:* \`${escapeCode(item.sku)}\`\n`
      } else {
        block += `*SKU:* \`${escapeCode(item.sku)}\`\n`
      }
      block += `   📦 ${item.quantityBoxes} ${escapeMarkdown(pType)}\n`
      block += `   ⚖️ ${totalItemWeight} kg \\(${weight} kg/${escapeMarkdown(pType)}\\)\n`
      if (price > 0) {
        block += `   💰 ${escapeMarkdown(formatNum(price))} × ${item.quantityBoxes}\n`
        block += `   \\= *${escapeMarkdown(formatNum(subtotal))} so'm*\n`
      }
      return block
    })
    .join('\n')

  let message = `🛒 *YANGI BUYURTMA*\n\n`
  message += `🆔 *\\#${escapeMarkdown(data.orderNumber)}*\n\n`
  message += `👤 *Mijoz:*\n${escapeMarkdown(data.customerName)}\n\n`
  message += `📞 *Telefon:*\n${escapeMarkdown(data.phone)}\n\n`
  message += `📦 *MAHSULOTLAR:*\n${itemLines}\n`
  message += `📊 *Jami:* ${data.totalBoxes} qadoq / ${data.totalWeight} kg\n`

  if (data.totalRevenue && data.totalRevenue > 0) {
    message += `💰 *Jami summa:* *${escapeMarkdown(formatNum(data.totalRevenue))} so'm*\n`
  }

  if (data.visitTime) {
    const visitDate = new Date(data.visitTime).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tashkent',
    })
    message += `\n🕐 *Kelish vaqti:*\n${escapeMarkdown(visitDate)}\n`
  }

  if (data.note) {
    message += `\n📝 *Izoh:*\n${escapeMarkdown(data.note)}\n`
  }

  return message
}

export async function sendOrderNotification(
  data: TelegramOrderNotification
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    console.warn('[Telegram] Bot token or chat ID not configured, skipping notification')
    return
  }

  const message = formatTelegramMessage(data)

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'MarkdownV2',
        }),
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!response.ok) {
      const err = await response.json()
      console.error('[Telegram] Send failed:', err)
    }
  } catch (error) {
    console.error('[Telegram] Request error:', error)
  }
}
