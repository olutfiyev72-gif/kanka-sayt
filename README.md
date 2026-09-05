# KANKA — Warehouse Pre-Order System

Ombordagi mahsulot mavjudligini real-vaqtda ko'rsatadigan va mijozga oldindan rezerv/buyurtma qilish imkonini beradigan platforma.

---

## Texnologiyalar

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Notifications**: Telegram Bot API
- **Deployment**: Vercel

---

## LOCAL DEVELOPMENT — Boshlash

### 1. Node.js o'rnatish

```bash
# macOS — Homebrew orqali (tavsiya etiladi):
brew install node

# Yoki NVM orqali:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

### 2. Loyihani klonlash

```bash
cd /Users/macbook/warehouse-preorder
```

### 3. Dependencies o'rnatish

```bash
npm install
```

### 4. Environment variables sozlash

```bash
cp .env.example .env.local
# .env.local faylini to'ldiring
```

### 5. Supabase sozlash

1. [supabase.com](https://supabase.com) ga kiring
2. Yangi project yarating
3. Project Settings → API dan URL va keys oling
4. `.env.local` ga qo'shing

**Database migrations o'rnatish:**
```sql
-- Supabase Dashboard → SQL Editor ga boring
-- supabase/migrations/001_initial_schema.sql faylini nusxalang va Run qiling
```

**Seed data (development uchun):**
```sql
-- supabase/seed.sql faylini SQL Editor da Run qiling
```

### 6. Supabase Storage bucket yaratish

```
Supabase Dashboard → Storage → New Bucket
Name: images
Public: YES
```

### 7. Dev server ishga tushirish

```bash
npm run dev
# → http://localhost:3000
```

---

## ADMIN YARATISH

1. Supabase Dashboard → Authentication → Users
2. "Invite user" → email va parol kiriting
3. `/admin/login` ga kiring

---

## TELEGRAM SOZLASH

1. Telegram da `@BotFather` ga yozing
2. `/newbot` → nom va username bering
3. Token oling
4. Botni guruhingizga qo'shing
5. Chat ID olish: `https://api.telegram.org/bot{TOKEN}/getUpdates`
6. `.env.local` ga qo'shing:
   ```
   TELEGRAM_BOT_TOKEN=your_token
   TELEGRAM_CHAT_ID=-100xxxxxxxxxx
   ```
7. Yoki Admin Panel → Settings dan ham sozlash mumkin

---

## PRODUCTION DEPLOYMENT (Vercel)

```bash
# 1. Vercel CLI o'rnatish
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod
```

**Vercel Dashboard → Environment Variables:**
Barcha `.env.example` dagi o'zgaruvchilarni qo'shing.

---

## ROUTES

### Public
| Route | Description |
|-------|-------------|
| `/` | Bosh sahifa |
| `/products` | Mahsulotlar katalogi |
| `/products/[slug]` | Mahsulot detail |
| `/checkout` | Buyurtma berish |
| `/order-success/[id]` | Muvaffaqiyatli buyurtma |
| `/about` | Biz haqimizda |
| `/contact` | Aloqa |

### Admin (protected)
| Route | Description |
|-------|-------------|
| `/admin/login` | Admin kirish |
| `/admin` | Dashboard |
| `/admin/products` | Mahsulotlar ro'yxati |
| `/admin/products/new` | Yangi mahsulot |
| `/admin/products/[id]` | Mahsulotni tahrirlash |
| `/admin/stock` | Stock boshqaruv |
| `/admin/orders` | Buyurtmalar |
| `/admin/orders/[id]` | Buyurtma detail |
| `/admin/settings` | Sozlamalar |

### API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/products` | GET | Faol mahsulotlar |
| `/api/products` | POST | Mahsulot yaratish |
| `/api/products/[id]` | PATCH | Mahsulot yangilash |
| `/api/products/[id]` | DELETE | Mahsulot o'chirish |
| `/api/orders` | POST | **Atomic order yaratish** |
| `/api/orders` | GET | Buyurtmalar ro'yxati |
| `/api/orders/[id]` | GET | Buyurtma detail |
| `/api/orders/[id]/status` | PATCH | Status o'zgartirish |
| `/api/stock` | POST | Stock o'zgartirish |
| `/api/stock/history` | GET | Stock tarixi |
| `/api/settings` | GET/PATCH | Sozlamalar |

---

## QA CHECKLIST (AC-01 → AC-20)

- [ ] AC-01: Admin product yaratadi → public katalogda ko'rinadi
- [ ] AC-02: Admin stock = 23 → customer "23 karopka mavjud" ko'radi
- [ ] AC-03: Customer 3 karopka tanlaydi → order summary da 3 ko'rinadi
- [ ] AC-04: Multiple products → bitta order ichida
- [ ] AC-05: Order submit → database da yaratiladi
- [ ] AC-06: Stock: Available 23→20, Reserved 0→3
- [ ] AC-07: Admin orderni ko'radi
- [ ] AC-08: Admin → CONFIRMED
- [ ] AC-09: Admin → READY
- [ ] AC-10: Admin → COMPLETED → stock final chiqariladi
- [ ] AC-11: CANCELLED → reserved stock release bo'ladi
- [ ] AC-12: Available = 0 → "Hozircha mavjud emas"
- [ ] AC-13: Customer mavjud stockdan ko'p tanlay olmaydi
- [ ] AC-14: Race condition → overselling bo'lmaydi
- [ ] AC-15: Telegram notification keladi
- [ ] AC-16: Admin bo'lmagan user admin ga kira olmaydi
- [ ] AC-17: Mobile UX ishlaydi
- [ ] AC-18: Refresh dan keyin order yo'qolmaydi
- [ ] AC-19: Stock movement history saqlanadi
- [ ] AC-20: Duplicate submit → ikkita order yaratilmaydi

---

## KNOWN LIMITATIONS (MVP)

1. Real-time stock (Supabase Realtime) o'rnatilmagan — order submit vaqtida server tekshiradi
2. Product edit page (`/admin/products/[id]`) — tez orada qo'shiladi
3. Admin roles — faqat ADMIN (MANAGER, WAREHOUSE kelajakda)
4. Telegram token settings dan olinadi — restart kerak bo'lishi mumkin
5. Image gallery — asosiy rasm (multiple gallery kelajakda)
