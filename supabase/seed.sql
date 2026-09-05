-- ============================================================
-- KANKA — Seed Data (Development Only)
-- Run AFTER migrations/001_initial_schema.sql
-- 
-- WARNING: Remove seed data before production launch
-- or run: DELETE FROM products WHERE name LIKE 'Mahsulot %';
-- ============================================================

-- Clear existing seed data (safe to re-run)
DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE customer_name = 'Test Mijoz'
);
DELETE FROM orders WHERE customer_name = 'Test Mijoz';
DELETE FROM products WHERE slug LIKE 'mahsulot-%';

-- Insert 10 sample products
INSERT INTO products (
  name, slug, description,
  weight_per_box, unit_name,
  total_stock, available_stock, reserved_stock,
  low_stock_threshold, is_active
) VALUES
  (
    'Mahsulot 01', 'mahsulot-01',
    'Yuqori sifatli mahsulot. Ideal ombor sharoitlarida saqlangan.',
    10, 'karopka', 23, 23, 0, 5, TRUE
  ),
  (
    'Mahsulot 02', 'mahsulot-02',
    'Premium sifat, eng ko''p sotiluvchi mahsulotlardan biri.',
    10, 'karopka', 8, 8, 0, 5, TRUE
  ),
  (
    'Mahsulot 03', 'mahsulot-03',
    'Katta hajmli buyurtmalar uchun qulay narx va sifat.',
    10, 'karopka', 15, 15, 0, 5, TRUE
  ),
  (
    'Mahsulot 04', 'mahsulot-04',
    'Cheklangan miqdorda mavjud. Tezroq band qiling!',
    10, 'karopka', 3, 3, 0, 5, TRUE
  ),
  (
    'Mahsulot 05', 'mahsulot-05',
    'Hozirda omborda mavjud emas. Tez orada keladi.',
    10, 'karopka', 0, 0, 0, 5, TRUE
  ),
  (
    'Mahsulot 06', 'mahsulot-06',
    'Yangi kelgan tovar. Sifati tekshirilgan va tayyorlangan.',
    12, 'karopka', 18, 18, 0, 5, TRUE
  ),
  (
    'Mahsulot 07', 'mahsulot-07',
    'Engil og''irlikdagi qulay qadoqlama.',
    5, 'karopka', 30, 30, 0, 8, TRUE
  ),
  (
    'Mahsulot 08', 'mahsulot-08',
    'Og''ir sifatli mahsulot, professional foydalanish uchun.',
    20, 'karopka', 12, 12, 0, 3, TRUE
  ),
  (
    'Mahsulot 09', 'mahsulot-09',
    'Ommabop mahsulot. Ko''p buyurtma qilinadi.',
    10, 'karopka', 45, 45, 0, 10, TRUE
  ),
  (
    'Mahsulot 10', 'mahsulot-10',
    'Maxsus qadoqlanadigan mahsulot.',
    8, 'karopka', 7, 7, 0, 5, FALSE  -- Inactive example
  );

-- ============================================================
-- Note: Stock movements for initial stock-in
-- ============================================================
INSERT INTO stock_movements (
  product_id, movement_type, quantity,
  previous_available, new_available,
  previous_total, new_total,
  reason
)
SELECT
  id, 'IN', total_stock,
  0, total_stock,
  0, total_stock,
  'Initial stock - seed data'
FROM products
WHERE slug LIKE 'mahsulot-%';
