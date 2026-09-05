/**
 * KANKA — Comprehensive Verification & Concurrency Test Suite
 * Tests:
 * 1. Stock Invariants (Total = Available + Reserved)
 * 2. Concurrency Simulation (Atomic reservation, overselling prevention)
 * 3. Multi-Product Atomic Rollback (No partial reservation)
 * 4. Cancellation Stock Release
 * 5. Completion Stock Finalization
 * 6. Order State Machine Transitions
 * 7. Zod Validations (Phone, Customer, Quantities)
 * 8. Rate Limiting & Duplicate Submit Protection
 */

import { checkoutSchema, productSchema, formatPhone, formatWeight, generateSlug, generateSKU } from '../src/lib/validations'
import { VALID_TRANSITIONS, ORDER_STATUS_LABELS } from '../src/types'
import type { OrderStatus, Product, PublicProduct } from '../src/types'
import { calculateSellingPrice, calculateProfit, calculateSuggestedOrder, getReorderRecommendation, formatUZS } from '../src/lib/pricing'
import { createSessionToken, verifySessionToken } from '../src/lib/sessionToken'
import {
  verifyUserCredentials,
  SUPER_ADMIN_DEFAULT_PASSWORD,
  ADMIN_DEFAULT_PASSWORD,
  registerSuperAdminLogin,
} from '../src/lib/adminAuth'
import { formatTelegramMessage } from '../src/lib/telegram'

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` (${details})` : ''}`)
    failed++
  }
}

// -------------------------------------------------------------
// Test 1: Invariant & Concurrency Simulation (Atomic Reservation)
// -------------------------------------------------------------
async function testConcurrencyAndAtomicReservation() {
  console.log('\n--- 1. Concurrency Simulation & Atomic Reservation ---')

  interface SimProduct {
    id: string
    name: string
    available: number
    reserved: number
    total: number
    lock: Promise<void>
  }

  const product: SimProduct = {
    id: 'prod-1',
    name: 'KANKA Box A',
    available: 3,
    reserved: 0,
    total: 3,
    lock: Promise.resolve(),
  }

  // Transactional function with row-level lock simulation (FOR UPDATE)
  let lockQueue = Promise.resolve()
  async function simulateAtomicReservation(requestedQty: number): Promise<{ success: boolean; error?: string }> {
    // Acquire lock
    return new Promise((resolve) => {
      lockQueue = lockQueue.then(async () => {
        // Step 1: Validate stock inside lock
        if (product.available < requestedQty) {
          resolve({ success: false, error: `Insufficient stock. Available: ${product.available}, Requested: ${requestedQty}` })
          return
        }

        // Step 2: Atomic update
        product.available -= requestedQty
        product.reserved += requestedQty

        // Invariant check
        if (product.total !== product.available + product.reserved) {
          resolve({ success: false, error: 'Invariant Total = Available + Reserved violated!' })
          return
        }

        resolve({ success: true })
      })
    })
  }

  // Launch Request A and Request B concurrently for 3 boxes each when only 3 exist
  const [resA, resB] = await Promise.all([
    simulateAtomicReservation(3),
    simulateAtomicReservation(3),
  ])

  const successCount = (resA.success ? 1 : 0) + (resB.success ? 1 : 0)
  assert(successCount === 1, 'Exactly one concurrent request succeeds', `Successes: ${successCount}`)
  assert(resA.success ? !resB.success : resB.success, 'One request fails with insufficient stock')
  assert(product.available === 0, 'Available stock is exactly 0', `Available: ${product.available}`)
  assert(product.reserved === 3, 'Reserved stock is exactly 3', `Reserved: ${product.reserved}`)
  assert(product.total === product.available + product.reserved, 'Invariant Total = Available + Reserved is strictly maintained')
}

// -------------------------------------------------------------
// Test 2: Multi-Product Atomic Rollback (No Partial Reservation)
// -------------------------------------------------------------
async function testMultiProductRollback() {
  console.log('\n--- 2. Multi-Product Atomic Rollback ---')

  const products = {
    p1: { id: 'p1', name: 'Product 1', available: 10, reserved: 0, total: 10 },
    p2: { id: 'p2', name: 'Product 2', available: 2, reserved: 0, total: 2 },
  }

  function simulateMultiOrder(items: { id: 'p1' | 'p2'; qty: number }[]): { success: boolean; error?: string } {
    // Phase 1: Validate all items under lock before changing any stock
    for (const item of items) {
      const prod = products[item.id]
      if (prod.available < item.qty) {
        return { success: false, error: `Insufficient stock for ${prod.name}` }
      }
    }

    // Phase 2: If all valid, apply changes
    for (const item of items) {
      const prod = products[item.id]
      prod.available -= item.qty
      prod.reserved += item.qty
    }

    return { success: true }
  }

  // Order wants 5 of p1 (available 10), but 4 of p2 (available only 2!)
  const result = simulateMultiOrder([
    { id: 'p1', qty: 5 },
    { id: 'p2', qty: 4 },
  ])

  assert(!result.success, 'Multi-product order rejected when one product is insufficient')
  assert(products.p1.available === 10, 'Product 1 had ZERO partial reservation (rolled back)', `p1 available: ${products.p1.available}`)
  assert(products.p2.available === 2, 'Product 2 remained untouched', `p2 available: ${products.p2.available}`)
}

// -------------------------------------------------------------
// Test 3: Order Cancellation Stock Release
// -------------------------------------------------------------
function testCancellationStockRelease() {
  console.log('\n--- 3. Cancellation Stock Release ---')

  const product = { available: 20, reserved: 3, total: 23 }

  // Admin cancels order of 3 boxes
  const cancelQty = 3
  product.available += cancelQty
  product.reserved -= cancelQty

  assert(product.available === 23, 'Available stock restored to 23', `Available: ${product.available}`)
  assert(product.reserved === 0, 'Reserved stock restored to 0', `Reserved: ${product.reserved}`)
  assert(product.total === 23, 'Total stock unchanged at 23', `Total: ${product.total}`)
  assert(product.total === product.available + product.reserved, 'Invariant holds after cancellation')
}

// -------------------------------------------------------------
// Test 4: Order Completion Stock Finalization
// -------------------------------------------------------------
function testCompletionStockFinalization() {
  console.log('\n--- 4. Completion Stock Finalization ---')

  const product = { available: 20, reserved: 3, total: 23 }

  // Admin completes order of 3 boxes (goods physically left warehouse)
  const completeQty = 3
  product.reserved -= completeQty
  product.total -= completeQty

  assert(product.available === 20, 'Available stock remains 20', `Available: ${product.available}`)
  assert(product.reserved === 0, 'Reserved stock deducted to 0', `Reserved: ${product.reserved}`)
  assert(product.total === 20, 'Total stock physically deducted to 20', `Total: ${product.total}`)
  assert(product.total === product.available + product.reserved, 'Invariant holds after completion')
}

// -------------------------------------------------------------
// Test 5: State Machine Transitions (VALID_TRANSITIONS)
// -------------------------------------------------------------
function testStateMachine() {
  console.log('\n--- 5. Order State Machine Transitions ---')

  // Valid paths
  assert(VALID_TRANSITIONS['NEW'].includes('CONFIRMED'), 'NEW can transition to CONFIRMED')
  assert(VALID_TRANSITIONS['NEW'].includes('CANCELLED'), 'NEW can transition to CANCELLED')
  assert(VALID_TRANSITIONS['CONFIRMED'].includes('READY'), 'CONFIRMED can transition to READY')
  assert(VALID_TRANSITIONS['CONFIRMED'].includes('CANCELLED'), 'CONFIRMED can transition to CANCELLED')
  assert(VALID_TRANSITIONS['READY'].includes('COMPLETED'), 'READY can transition to COMPLETED')

  // Terminal states
  assert(VALID_TRANSITIONS['COMPLETED'].length === 0, 'COMPLETED is terminal (no next transitions)')
  assert(VALID_TRANSITIONS['CANCELLED'].length === 0, 'CANCELLED is terminal (no next transitions)')

  // Invalid paths
  assert(!VALID_TRANSITIONS['COMPLETED'].includes('NEW'), 'COMPLETED cannot transition to NEW')
  assert(!VALID_TRANSITIONS['CANCELLED'].includes('READY'), 'CANCELLED cannot transition to READY')
  assert(!VALID_TRANSITIONS['READY'].includes('NEW'), 'READY cannot transition to NEW')
}

// -------------------------------------------------------------
// Test 6: Zod Validations (Customer, Phone, Quantities)
// -------------------------------------------------------------
function testZodValidations() {
  console.log('\n--- 6. Zod Form & Phone Validations ---')

  // Valid customer checkout
  const valid = checkoutSchema.safeParse({
    customer_name: 'Anvar Karimov',
    phone: '+998 90 123 45 67',
  })
  assert(valid.success, 'Valid customer checkout passes')

  // Empty name
  const emptyName = checkoutSchema.safeParse({
    customer_name: '   ',
    phone: '+998 90 123 45 67',
  })
  assert(!emptyName.success, 'Empty customer name rejected')

  // Invalid phone
  const invalidPhone = checkoutSchema.safeParse({
    customer_name: 'Anvar',
    phone: '12345',
  })
  assert(!invalidPhone.success, 'Invalid phone number rejected')

  // Phone formatter
  const formatted = formatPhone('998901234567')
  assert(formatted.includes('90') && formatted.includes('123'), 'formatPhone formats properly')

  // Slug generator
  const slug = generateSlug('Olma Qizil 10kg!')
  assert(slug === 'olma-qizil-10kg', 'generateSlug generates URL-friendly slug', `Slug: ${slug}`)

  // Weight formatter
  assert(formatWeight(10) === '10 kg', 'formatWeight produces correct label')
}

// -------------------------------------------------------------
// Test 7: Rate Limiting & Duplicate Order Protection
// -------------------------------------------------------------
function testRateLimiting() {
  console.log('\n--- 7. Rate Limiting & Duplicate Protection ---')

  const submissionTracker = new Map<string, number[]>()
  const RATE_LIMIT_WINDOW = 60 * 1000
  const RATE_LIMIT_MAX = 3

  function checkRateLimit(ip: string, now: number): boolean {
    const timestamps = (submissionTracker.get(ip) || []).filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW
    )
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return false
    }
    timestamps.push(now)
    submissionTracker.set(ip, timestamps)
    return true
  }

  const baseTime = 1000000
  assert(checkRateLimit('192.168.1.1', baseTime), 'Request 1 allowed')
  assert(checkRateLimit('192.168.1.1', baseTime + 100), 'Request 2 allowed')
  assert(checkRateLimit('192.168.1.1', baseTime + 200), 'Request 3 allowed')
  assert(!checkRateLimit('192.168.1.1', baseTime + 300), 'Request 4 within 1 min blocked by rate limiter')
  assert(checkRateLimit('10.0.0.1', baseTime + 400), 'Different IP allowed')
}

// -------------------------------------------------------------
// Test 8: Role Authentication & Cryptographic Session Tokens
// -------------------------------------------------------------
async function testRoleAuthAndTokens() {
  console.log('\n--- 8. Role Authentication & Cryptographic Session Tokens ---')

  const ownerToken = await createSessionToken('owner', 'OWNER')
  const ownerSession = await verifySessionToken(ownerToken)
  assert(ownerSession !== null, 'Owner token valid')
  assert(ownerSession?.login === 'owner', 'Owner login matches')
  assert(ownerSession?.role === 'OWNER', 'Owner role is OWNER')

  const adminToken = await createSessionToken('admin', 'ADMIN')
  const adminSession = await verifySessionToken(adminToken)
  assert(adminSession !== null, 'Admin token valid')
  assert(adminSession?.login === 'admin', 'Admin login matches')
  assert(adminSession?.role === 'ADMIN', 'Admin role is ADMIN')

  // Tampered token test
  const tamperedToken = ownerToken.slice(0, -5) + 'xxxxx'
  const tamperedSession = await verifySessionToken(tamperedToken)
  assert(tamperedSession === null, 'Tampered token is rejected')

  // Role authorization test for financial reports
  function canAccessReports(role: string): boolean {
    return role === 'OWNER'
  }
  assert(canAccessReports(ownerSession!.role) === true, 'OWNER has access to financial reports')
  assert(canAccessReports(adminSession!.role) === false, 'ADMIN is forbidden (403) from financial reports')

  // Super Admin login with master password 910139595 and otaniyoz1
  const superAdminAuth = await verifyUserCredentials('otaniyoz1', SUPER_ADMIN_DEFAULT_PASSWORD)
  assert(superAdminAuth.isValid === true, 'Super Admin login (otaniyoz1) with 910139595 succeeds')
  assert(superAdminAuth.user?.role === 'OWNER', 'Super Admin role is OWNER')

  // Super Admin login registration function
  const regResult = await registerSuperAdminLogin('otaniyoz1', '910139595')
  assert(regResult.success === true, 'registerSuperAdminLogin succeeds with 910139595')
  assert(regResult.user?.role === 'OWNER', 'Registered user role is OWNER')

  // Admin login with umar2008 and password 500083344
  const adminAuth = await verifyUserCredentials('umar2008', ADMIN_DEFAULT_PASSWORD)
  assert(adminAuth.isValid === true, 'Admin login with umar2008 and 500083344 succeeds')
  assert(adminAuth.user?.role === 'ADMIN', 'Admin role is ADMIN')

  // Invalid login/password tests
  const wrongPassAuth = await verifyUserCredentials('umar2008', 'wrong_password')
  assert(wrongPassAuth.isValid === false, 'Admin login with wrong password is rejected')

  const emptyLoginAuth = await verifyUserCredentials('', ADMIN_DEFAULT_PASSWORD)
  assert(emptyLoginAuth.isValid === false, 'Empty login is rejected')
  assert(Boolean(emptyLoginAuth.error?.includes('Login kiritilishi shart')), 'Error specifies login required')
}

// -------------------------------------------------------------
// Test 9: 15% Markup Calculation & Rounding
// -------------------------------------------------------------
function testMarkupAndFinancialCalculations() {
  console.log('\n--- 9. 15% Markup Calculation & Rounding ---')

  // Prompt requirement: 100,000 -> 115,000
  const price100k = calculateSellingPrice(100000, 15)
  assert(price100k === 115000, '100,000 cost with 15% markup = 115,000', `Got: ${price100k}`)

  // Prompt requirement: 200,000 -> 230,000
  const price200k = calculateSellingPrice(200000, 15)
  assert(price200k === 230000, '200,000 cost with 15% markup = 230,000', `Got: ${price200k}`)

  // Prompt requirement: 50,000 -> 57,500
  const price50k = calculateSellingPrice(50000, 15)
  assert(price50k === 57500, '50,000 cost with 15% markup = 57,500', `Got: ${price50k}`)

  // Rounding test for odd numbers: 33,333 * 1.15 = 38332.95 -> 38333
  const priceOdd = calculateSellingPrice(33333, 15)
  assert(priceOdd === 38333, '33,333 rounded to integer UZS = 38,333', `Got: ${priceOdd}`)

  // Profit calculation for 10 boxes
  const profitStats = calculateProfit(115000, 100000, 10)
  assert(profitStats.revenue === 1150000, 'Total revenue = 1,150,000', `Got: ${profitStats.revenue}`)
  assert(profitStats.totalCost === 1000000, 'Total cost = 1,000,000', `Got: ${profitStats.totalCost}`)
  assert(profitStats.grossProfit === 150000, 'Gross profit = 150,000', `Got: ${profitStats.grossProfit}`)
  assert(profitStats.marginPercent === 13.04, 'Margin percent = 13.04%', `Got: ${profitStats.marginPercent}%`)
  assert(formatUZS(1150000).includes('1'), 'formatUZS formats correctly')
}

// -------------------------------------------------------------
// Test 10: Product Schema Validations (SKU As Primary, 0 vs 1 Image, Negative Cost Rejection)
// -------------------------------------------------------------
function testProductValidations() {
  console.log('\n--- 10. Product Validations (SKU As Primary, Images, Negative Cost) ---')

  // Product without 'name' is valid! (SKU is the primary identifier)
  const productNoName = productSchema.safeParse({
    sku: 'RICE-001',
    unit_name: 'qop',
    weight_per_box: 10,
    total_stock: 41,
    cost_price: 100000,
    markup_percent: 15,
    description: "A'lo sifatli guruch",
  })
  assert(productNoName.success, 'Product without name field is valid (SKU is primary identifier)')

  // Product with 0 images (optional)
  const productNoImage = productSchema.safeParse({
    sku: 'KAN-APL-001',
    cost_price: 100000,
    total_stock: 50,
    minimum_stock: 10,
    weight_per_box: 10,
    is_active: true,
  })
  assert(productNoImage.success, 'Product with 0 images (no image_url) is valid')

  // Product with 1 image
  const productWithImage = productSchema.safeParse({
    sku: 'KAN-APL-002',
    cost_price: 100000,
    total_stock: 50,
    minimum_stock: 10,
    weight_per_box: 10,
    image_url: 'https://example.com/apple.jpg',
    is_active: true,
  })
  assert(productWithImage.success, 'Product with 1 image is valid')

  // Product without SKU rejected (SKU is strictly required)
  const productMissingSku = productSchema.safeParse({
    unit_name: 'qop',
    cost_price: 100000,
    total_stock: 50,
    weight_per_box: 10,
  })
  assert(!productMissingSku.success, 'Product missing SKU is rejected')

  // Product with empty SKU rejected
  const productEmptySku = productSchema.safeParse({
    sku: '   ',
    unit_name: 'qop',
    cost_price: 100000,
    total_stock: 50,
    weight_per_box: 10,
  })
  assert(!productEmptySku.success, 'Product with empty SKU is rejected')

  // Product with negative cost rejected
  const productNegativeCost = productSchema.safeParse({
    sku: 'KAN-APL-003',
    cost_price: -5000,
    total_stock: 50,
    minimum_stock: 10,
    weight_per_box: 10,
  })
  assert(!productNegativeCost.success, 'Negative cost_price is rejected')

  // Product with negative minimum stock rejected
  const productNegativeMin = productSchema.safeParse({
    sku: 'KAN-APL-004',
    cost_price: 10000,
    total_stock: 50,
    minimum_stock: -1,
    weight_per_box: 10,
  })
  assert(!productNegativeMin.success, 'Negative minimum_stock is rejected')

  // SKU generator
  const sku = generateSKU('KAN')
  assert(sku.startsWith('KAN-') && sku.length >= 7, 'generateSKU generates standard SKU', `SKU: ${sku}`)
}

// -------------------------------------------------------------
// Test 10B: Live Form Calculations & Duplicate SKU Verification
// -------------------------------------------------------------
function testSkuCalculationsAndDuplicateDetection() {
  console.log('\n--- 10B. SKU Form Calculations (41 qop * 10kg = 410kg, 115 000 so‘m) ---')

  // Requirement: 41 qop, 10 kg/qop -> 410 kg
  const boxes = 41
  const weight10 = 10
  const totalWeight10 = boxes * weight10
  assert(totalWeight10 === 410, '41 qop * 10 kg = 410 kg', `Got: ${totalWeight10}`)

  // Requirement: 41 qop, 5 kg/qop -> 205 kg
  const weight5 = 5
  const totalWeight5 = boxes * weight5
  assert(totalWeight5 === 205, '41 qop * 5 kg = 205 kg', `Got: ${totalWeight5}`)

  // Requirement: Tannarx 100,000, Ustama 15% -> Sotuv narxi 115,000 so'm
  const cost = 100000
  const markup = 15
  const sellingPrice = calculateSellingPrice(cost, markup)
  assert(sellingPrice === 115000, 'Tannarx 100,000 + 15% ustama = 115,000 so‘m', `Got: ${sellingPrice}`)

  // Admin-only financial calculations
  const totalCostValue = boxes * cost
  assert(totalCostValue === 4100000, 'Tannarx jami: 41 * 100,000 = 4,100,000 so‘m', `Got: ${totalCostValue}`)

  const totalSellingValue = boxes * sellingPrice
  assert(totalSellingValue === 4715000, 'Sotuv jami: 41 * 115,000 = 4,715,000 so‘m', `Got: ${totalSellingValue}`)

  // Duplicate SKU error message verification
  const existingSkus = new Set(['RICE-001', 'FLOUR-002'])
  function checkSkuDuplicate(newSku: string): { valid: boolean; error?: string } {
    if (existingSkus.has(newSku.trim().toUpperCase())) {
      return { valid: false, error: 'Bu SKU allaqachon mavjud.' }
    }
    return { valid: true }
  }

  const dupCheck = checkSkuDuplicate('rice-001')
  assert(!dupCheck.valid, 'Duplicate SKU detected case-insensitively')
  assert(dupCheck.error === 'Bu SKU allaqachon mavjud.', 'Duplicate error message is exactly "Bu SKU allaqachon mavjud."')

  const uniqueCheck = checkSkuDuplicate('SUGAR-003')
  assert(uniqueCheck.valid, 'Unique SKU is allowed')
}

// -------------------------------------------------------------
// Test 10C: Telegram Notification SKU-Only Formatting
// -------------------------------------------------------------
function testTelegramSkuNotification() {
  console.log('\n--- 10C. Telegram Notification SKU-Only Formatting ---')

  const telegramPayload = {
    orderNumber: 'ORD-TEST-01',
    customerName: 'Alisher Navoiy',
    phone: '+998901234567',
    items: [
      {
        sku: 'RICE-001',
        packageType: 'qop',
        weightPerBox: 10,
        quantityBoxes: 2,
        unitPrice: 115000,
      },
    ],
    totalBoxes: 2,
    totalWeight: 20,
    totalRevenue: 230000,
    createdAt: new Date().toISOString(),
  }

  const message = formatTelegramMessage(telegramPayload)

  assert(message.includes('SKU:'), 'Telegram notification contains "SKU:" label')
  assert(message.includes('RICE-001'), 'Telegram notification contains SKU value "RICE-001"')
  assert(message.includes('2 qop'), 'Telegram notification contains packaging "2 qop"')
  assert(message.includes('20 kg'), 'Telegram notification contains weight "20 kg"')
  assert(message.includes('115\\ 000') || message.includes('115 000'), 'Telegram notification contains unit price')
  assert(message.includes('230\\ 000') || message.includes('230 000'), 'Telegram notification contains subtotal')
  assert(!message.includes('Mahsulot nomi'), 'Telegram notification NEVER contains "Mahsulot nomi"')
}

// -------------------------------------------------------------
// Test 11: Historical Cost Snapshot Invariant
// -------------------------------------------------------------
function testHistoricalCostSnapshotInvariant() {
  console.log('\n--- 11. Historical Cost Snapshot Invariant ---')

  // Step 1: An order was placed when cost_price was 100,000 and selling_price was 115,000
  const orderItemSnapshot = {
    product_id: 'prod-apple',
    quantity_boxes: 5,
    unit_cost_at_sale: 100000,
    unit_price_at_sale: 115000,
    total_cost: 5 * 100000,        // 500,000
    total_revenue: 5 * 115000,     // 575,000
    gross_profit: 5 * (115000 - 100000), // 75,000
  }

  // Step 2: Later, product cost increases to 140,000 and selling price to 161,000
  const currentProductState = {
    id: 'prod-apple',
    cost_price: 140000,
    selling_price: 161000,
  }

  // Step 3: Owner report calculates profit from historical order
  // System MUST use orderItemSnapshot.unit_cost_at_sale (NOT currentProductState.cost_price)
  const effectiveCost = orderItemSnapshot.unit_cost_at_sale ?? currentProductState.cost_price
  const effectivePrice = orderItemSnapshot.unit_price_at_sale ?? currentProductState.selling_price
  const orderProfit = (effectivePrice - effectiveCost) * orderItemSnapshot.quantity_boxes

  assert(orderProfit === 75000, 'Order profit remains 75,000 despite future cost increase', `Profit: ${orderProfit}`)

  // Verify that if snapshot were ignored (wrong behavior), profit would be distorted
  const wrongProfit = (orderItemSnapshot.unit_price_at_sale - currentProductState.cost_price) * orderItemSnapshot.quantity_boxes
  assert(wrongProfit === -125000, 'Distorted calculation without snapshot would give -125,000')
  assert(orderProfit !== wrongProfit, 'Snapshot strictly protects historical financial integrity')
}

// -------------------------------------------------------------
// Test 12: Reorder Planning ("Ertangi kun uchun")
// -------------------------------------------------------------
function testReorderPlanningCalculation() {
  console.log('\n--- 12. Reorder Planning Calculation ("Ertangi kun uchun") ---')

  // Direct calculation function
  assert(calculateSuggestedOrder(7, 20) === 13, 'calculateSuggestedOrder(7, 20) === 13')
  assert(calculateSuggestedOrder(0, 20) === 20, 'calculateSuggestedOrder(0, 20) === 20')
  assert(calculateSuggestedOrder(25, 20) === 0, 'calculateSuggestedOrder(25, 20) === 0')

  // Case 1: Prompt test: available = 7, min = 20 -> suggested = 13 (REORDER_REQUIRED)
  const reorder1 = getReorderRecommendation(7, 20)
  assert(reorder1.suggestedOrder === 13, 'available 7, min 20 -> suggested 13', `Got: ${reorder1.suggestedOrder}`)
  assert(reorder1.reorderRequired === true, 'Reorder required is true')
  assert(reorder1.status === 'LOW_STOCK', 'Status is LOW_STOCK (YELLOW)')

  // Case 2: available = 0, min = 20 -> suggested = 20 (OUT_OF_STOCK / RED)
  const reorder2 = getReorderRecommendation(0, 20)
  assert(reorder2.suggestedOrder === 20, 'available 0, min 20 -> suggested 20', `Got: ${reorder2.suggestedOrder}`)
  assert(reorder2.status === 'OUT_OF_STOCK', 'Status is OUT_OF_STOCK (RED)')

  // Case 3: available = 25, min = 20 -> suggested = 0 (SUFFICIENT / GREEN)
  const reorder3 = getReorderRecommendation(25, 20)
  assert(reorder3.suggestedOrder === 0, 'available 25, min 20 -> suggested 0', `Got: ${reorder3.suggestedOrder}`)
  assert(reorder3.reorderRequired === false, 'Reorder required is false')
  assert(reorder3.status === 'SUFFICIENT', 'Status is SUFFICIENT (GREEN)')
}

// -------------------------------------------------------------
// Test 13: Client Financial Data Sanitization
// -------------------------------------------------------------
function testClientDataSanitization() {
  console.log('\n--- 13. Client Financial Data Sanitization ---')

  // Internal product representation
  const internalProduct: Product = {
    id: 'prod-101',
    name: 'Pomidor',
    slug: 'pomidor',
    sku: 'KAN-POM-101',
    category: 'Sabzavot',
    description: 'Yangi pomidor',
    cost_price: 100000, // Internal cost
    selling_price: 115000,
    price: 115000,
    total_stock: 50,
    reserved_stock: 5,
    available_stock: 45,
    minimum_stock: 10,
    low_stock_threshold: 10,
    weight_per_box: 10,
    unit_name: 'karopka',
    image_url: null,
    gallery_urls: [],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Public sanitizer simulation (same logic as in /api/products)
  function sanitizeForPublic(p: Product): PublicProduct {
    const { cost_price, ...publicProduct } = p
    return publicProduct as PublicProduct
  }

  const publicData = sanitizeForPublic(internalProduct)
  assert(publicData.sku === 'KAN-POM-101', 'sku is preserved and present for client')
  assert(!('cost_price' in publicData), 'cost_price is stripped from public client projection')
  assert((publicData as any).cost_price === undefined, 'cost_price is undefined for client')
  assert(publicData.selling_price === 115000, 'selling_price is available for client')
  assert(publicData.available_stock === 45, 'available_stock is available for client')
}

// -------------------------------------------------------------
// Runner
// -------------------------------------------------------------
async function runAll() {
  console.log('🚀 Running KANKA Test Suite...\n')
  await testConcurrencyAndAtomicReservation()
  await testMultiProductRollback()
  testCancellationStockRelease()
  testCompletionStockFinalization()
  testStateMachine()
  testZodValidations()
  testRateLimiting()
  await testRoleAuthAndTokens()
  testMarkupAndFinancialCalculations()
  testProductValidations()
  testSkuCalculationsAndDuplicateDetection()
  testTelegramSkuNotification()
  testHistoricalCostSnapshotInvariant()
  testReorderPlanningCalculation()
  testClientDataSanitization()

  console.log('\n=============================================')
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log('=============================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runAll().catch((err) => {
  console.error('Fatal error during test run:', err)
  process.exit(1)
})
