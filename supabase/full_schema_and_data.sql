-- ============================================================
-- KANKA — FULL SUPABASE SCHEMA & SAMPLE DATA
-- To'liq sxema, jadvallar, RLS qoidalari, atomik funksiyalar va namunaviy ma'lumotlar
-- Supabase Dashboard -> SQL Editor sahifasiga nusxalab qo'yib, "Run" tugmasini bosing.
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'NEW',
      'CONFIRMED',
      'READY',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END $$;

-- ============================================================
-- 3. JADVALLAR (TABLES)
-- ============================================================

-- JADVAL: products (Mahsulotlar - SKU asosiy identifikator)
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT,
  weight_per_box      NUMERIC(10, 2) NOT NULL DEFAULT 10,
  unit_name           TEXT NOT NULL DEFAULT 'Qop',
  cost_price          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  markup_percent      NUMERIC(5, 2) NOT NULL DEFAULT 15,
  selling_price       NUMERIC(15, 2) NOT NULL DEFAULT 0,
  price               NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_stock         INTEGER NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
  available_stock     INTEGER NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
  reserved_stock      INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  minimum_stock       INTEGER NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  image_url           TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_invariant CHECK (total_stock = available_stock + reserved_stock)
);

-- JADVAL: orders (Buyurtmalar)
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT NOT NULL UNIQUE,
  customer_name   TEXT NOT NULL,
  phone           TEXT NOT NULL,
  visit_time      TIMESTAMPTZ,
  note            TEXT,
  status          order_status NOT NULL DEFAULT 'NEW',
  total_boxes     INTEGER NOT NULL DEFAULT 0 CHECK (total_boxes >= 0),
  total_weight    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(15, 2) DEFAULT 0,
  total_revenue   NUMERIC(15, 2) DEFAULT 0,
  gross_profit    NUMERIC(15, 2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JADVAL: order_items (Buyurtma tarkibidagi mahsulotlar)
CREATE TABLE IF NOT EXISTS order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
  sku_snapshot          TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity_boxes        INTEGER NOT NULL CHECK (quantity_boxes > 0),
  unit_cost_at_sale     NUMERIC(15, 2),
  unit_price_at_sale    NUMERIC(15, 2),
  total_cost            NUMERIC(15, 2),
  total_revenue         NUMERIC(15, 2),
  gross_profit          NUMERIC(15, 2),
  unit_weight           NUMERIC(10, 2) NOT NULL,
  total_weight          NUMERIC(10, 2) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JADVAL: stock_movements (Ombor qoldig'i harakatlari tarixi)
CREATE TABLE IF NOT EXISTS stock_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type       TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity            INTEGER NOT NULL,
  previous_available  INTEGER NOT NULL,
  new_available       INTEGER NOT NULL,
  previous_total      INTEGER NOT NULL,
  new_total           INTEGER NOT NULL,
  reason              TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JADVAL: audit_logs (Tizim xavfsizlik va audit jurnali)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JADVAL: settings (Tizim sozlamalari)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. INDEKSLAR (Tezlik uchun)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

-- ============================================================
-- 5. ATOMIK TRANZAKSIYALAR (STORED PROCEDURES)
-- ============================================================

-- Buyurtmani zaxiralash bilan yaratish (Overselling'ning oldini oladi)
CREATE OR REPLACE FUNCTION create_order_atomic(
  p_customer_name TEXT,
  p_phone         TEXT,
  p_visit_time    TIMESTAMPTZ DEFAULT NULL,
  p_note          TEXT DEFAULT NULL,
  p_items         JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id      UUID;
  v_order_number  TEXT;
  v_total_boxes   INTEGER := 0;
  v_total_weight  NUMERIC := 0;
  v_order_cost    NUMERIC := 0;
  v_order_revenue NUMERIC := 0;
  v_order_profit  NUMERIC := 0;
  v_item          JSONB;
  v_product       RECORD;
  v_product_id    UUID;
  v_qty           INTEGER;
  v_item_cost     NUMERIC;
  v_item_price    NUMERIC;
  v_item_tot_cost NUMERIC;
  v_item_tot_rev  NUMERIC;
  v_item_profit   NUMERIC;
  v_result        JSONB;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Buyurtmada kamida bitta mahsulot bo‘lishi shart' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Mahsulotlarni qulflash va qoldiqni tekshirish
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'quantity_boxes')::INTEGER;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Miqdor 0 dan katta bo‘lishi kerak' USING ERRCODE = 'P0002';
    END IF;

    SELECT id, sku, name, available_stock, weight_per_box, is_active, cost_price, selling_price, price
    INTO v_product
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Mahsulot topilmadi: %', v_product_id USING ERRCODE = 'P0003';
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Mahsulot nofaol: %', v_product.sku USING ERRCODE = 'P0004';
    END IF;

    IF v_product.available_stock < v_qty THEN
      RAISE EXCEPTION 'Qoldiq yetarli emas. SKU: %, Mavjud: %, So‘ralgan: %',
        v_product.sku, v_product.available_stock, v_qty
        USING ERRCODE = 'P0005';
    END IF;
  END LOOP;

  -- 2. Buyurtma raqamini hosil qilish (ORD-YYYYMMDD-XXXX)
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

  INSERT INTO orders (
    order_number, customer_name, phone, visit_time, note,
    status, total_boxes, total_weight, total_cost, total_revenue, gross_profit
  ) VALUES (
    v_order_number, p_customer_name, p_phone, p_visit_time, p_note,
    'NEW', 0, 0, 0, 0, 0
  ) RETURNING id INTO v_order_id;

  -- 3. Zaxiralash va order_items yozish
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'quantity_boxes')::INTEGER;

    SELECT * INTO v_product FROM products WHERE id = v_product_id;

    v_item_cost     := COALESCE(v_product.cost_price, 0);
    v_item_price    := COALESCE(NULLIF(v_product.selling_price, 0), v_product.price, 0);
    v_item_tot_cost := v_item_cost * v_qty;
    v_item_tot_rev  := v_item_price * v_qty;
    v_item_profit   := v_item_tot_rev - v_item_tot_cost;

    INSERT INTO order_items (
      order_id, product_id, sku_snapshot, product_name_snapshot,
      quantity_boxes, unit_weight, total_weight,
      unit_cost_at_sale, unit_price_at_sale,
      total_cost, total_revenue, gross_profit
    ) VALUES (
      v_order_id, v_product_id, v_product.sku, v_product.sku,
      v_qty, v_product.weight_per_box, v_qty * v_product.weight_per_box,
      v_item_cost, v_item_price,
      v_item_tot_cost, v_item_tot_rev, v_item_profit
    );

    UPDATE products
    SET available_stock = available_stock - v_qty,
        reserved_stock  = reserved_stock + v_qty,
        updated_at      = NOW()
    WHERE id = v_product_id;

    v_total_boxes   := v_total_boxes + v_qty;
    v_total_weight  := v_total_weight + (v_qty * v_product.weight_per_box);
    v_order_cost    := v_order_cost + v_item_tot_cost;
    v_order_revenue := v_order_revenue + v_item_tot_rev;
    v_order_profit  := v_order_profit + v_item_profit;
  END LOOP;

  UPDATE orders
  SET total_boxes   = v_total_boxes,
      total_weight  = v_total_weight,
      total_cost    = v_order_cost,
      total_revenue = v_order_revenue,
      gross_profit  = v_order_profit,
      updated_at    = NOW()
  WHERE id = v_order_id;

  SELECT jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'total_boxes',  v_total_boxes,
    'total_weight', v_total_weight,
    'total_revenue', v_order_revenue,
    'status',       'NEW'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Buyurtmani bekor qilish (Zaxirani omborga qaytarish)
CREATE OR REPLACE FUNCTION cancel_order_atomic(
  p_order_id UUID,
  p_reason   TEXT DEFAULT 'Bekor qilindi'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_item  RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buyurtma topilmadi: %', p_order_id;
  END IF;

  IF v_order.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Ushbu statusdagi buyurtmani bekor qilib bo‘lmaydi: %', v_order.status;
  END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      UPDATE products
      SET available_stock = available_stock + v_item.quantity_boxes,
          reserved_stock  = reserved_stock - v_item.quantity_boxes,
          updated_at      = NOW()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  UPDATE orders
  SET status     = 'CANCELLED',
      updated_at = NOW(),
      note       = COALESCE(note || ' | ', '') || 'Bekor qilish sababi: ' || p_reason
  WHERE id = p_order_id;
END;
$$;

-- Buyurtmani yakunlash (Jismonan ombordan chiqarish)
CREATE OR REPLACE FUNCTION complete_order_atomic(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_item  RECORD;
  v_prod  RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buyurtma topilmadi: %', p_order_id;
  END IF;

  IF v_order.status != 'READY' AND v_order.status != 'CONFIRMED' THEN
    RAISE EXCEPTION 'Buyurtma faqat TAYYOR yoki TASDIQLANGAN holatda yakunlanishi mumkin: %', v_order.status;
  END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT * INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;

      UPDATE products
      SET total_stock    = total_stock - v_item.quantity_boxes,
          reserved_stock = reserved_stock - v_item.quantity_boxes,
          updated_at     = NOW()
      WHERE id = v_item.product_id;

      INSERT INTO stock_movements (
        product_id, movement_type, quantity,
        previous_available, new_available,
        previous_total, new_total, reason
      ) VALUES (
        v_item.product_id, 'OUT', v_item.quantity_boxes,
        v_prod.available_stock, v_prod.available_stock,
        v_prod.total_stock, v_prod.total_stock - v_item.quantity_boxes,
        'Buyurtma yakunlandi #' || v_order.order_number
      );
    END IF;
  END LOOP;

  UPDATE orders
  SET status     = 'COMPLETED',
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

-- ============================================================
-- 6. XAVFSIZLIK (ROW LEVEL SECURITY - RLS)
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Ommaviy foydalanuvchilar (Mijozlar) faqat faol mahsulotlarni o'qiy oladi
DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (is_active = TRUE);

-- Mijozlar buyurtma bera oladi
DROP POLICY IF EXISTS "Public can insert orders" ON orders;
CREATE POLICY "Public can insert orders"
  ON orders FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public can read own order by id" ON orders;
CREATE POLICY "Public can read own order by id"
  ON orders FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Public can insert order items" ON order_items;
CREATE POLICY "Public can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public can read order items" ON order_items;
CREATE POLICY "Public can read order items"
  ON order_items FOR SELECT
  USING (TRUE);

-- Service Role (Server backend) barcha jadvallarga to'liq ruxsatga ega
DROP POLICY IF EXISTS "Service role full access products" ON products;
CREATE POLICY "Service role full access products" ON products FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access orders" ON orders;
CREATE POLICY "Service role full access orders" ON orders FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access order_items" ON order_items;
CREATE POLICY "Service role full access order_items" ON order_items FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access stock_movements" ON stock_movements;
CREATE POLICY "Service role full access stock_movements" ON stock_movements FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access audit_logs" ON audit_logs;
CREATE POLICY "Service role full access audit_logs" ON audit_logs FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access settings" ON settings;
CREATE POLICY "Service role full access settings" ON settings FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- 7. NAMUNAVIY MAHSULOTLAR (REAL DATA INSERT)
-- ============================================================
DELETE FROM products WHERE sku IN (
  'GURUCH-ALANGA-25',
  'UN-QOZOQ-1-50',
  'SHAKAR-XORAZM-50',
  'YOG-PISTA-5L',
  'MAKARON-ELITA-20',
  'CHOY-KO-95-10',
  'TUZ-YODLANGAN-25',
  'NOXAT-PREMIUM-30'
);

INSERT INTO products (
  sku, name, slug, description,
  unit_name, weight_per_box,
  cost_price, markup_percent, selling_price, price,
  total_stock, available_stock, reserved_stock,
  minimum_stock, low_stock_threshold, is_active
) VALUES
  (
    'GURUCH-ALANGA-25', 'GURUCH-ALANGA-25', 'guruch-alanga-25',
    'Oliy sifatli Xorazm Alanga guruchi. 1 qop 25 kg.',
    'Qop', 25,
    180000, 15, 207000, 207000,
    45, 45, 0, 10, 10, TRUE
  ),
  (
    'UN-QOZOQ-1-50', 'UN-QOZOQ-1-50', 'un-qozoq-1-50',
    'Qozog‘iston 1-navli oq bug‘doy uni. 1 qop 50 kg.',
    'Qop', 50,
    260000, 15, 299000, 299000,
    30, 30, 0, 10, 10, TRUE
  ),
  (
    'SHAKAR-XORAZM-50', 'SHAKAR-XORAZM-50', 'shakar-xorazm-50',
    'Xorazm shakar zavodi mahsuloti, toza oq shakar. 50 kg.',
    'Qop', 50,
    420000, 12, 470400, 470400,
    25, 25, 0, 8, 8, TRUE
  ),
  (
    'YOG-PISTA-5L', 'YOG-PISTA-5L', 'yog-pista-5l',
    'Tozalangan kungaboqar yog‘i (1 karopkada 4 ta 5L idish).',
    'Karopka', 18,
    240000, 15, 276000, 276000,
    40, 40, 0, 10, 10, TRUE
  ),
  (
    'MAKARON-ELITA-20', 'MAKARON-ELITA-20', 'makaron-elita-20',
    'Qattiq bug‘doy navidan tayyorlangan oliy sifat makaron. 20 kg.',
    'Qop', 20,
    130000, 15, 149500, 149500,
    20, 20, 0, 5, 5, TRUE
  ),
  (
    'CHOY-KO-95-10', 'CHOY-KO-95-10', 'choy-ko-95-10',
    'Ko‘k choy №95 klassik ta’m. 1 karopka 10 kg.',
    'Karopka', 10,
    350000, 18, 413000, 413000,
    15, 15, 0, 5, 5, TRUE
  ),
  (
    'TUZ-YODLANGAN-25', 'TUZ-YODLANGAN-25', 'tuz-yodlangan-25',
    'Osh tuzi, yodlangan tozalangan. 1 qop 25 kg.',
    'Qop', 25,
    35000, 20, 42000, 42000,
    50, 50, 0, 15, 15, TRUE
  ),
  (
    'NOXAT-PREMIUM-30', 'NOXAT-PREMIUM-30', 'noxat-premium-30',
    'Yirik saralangan oq no‘xat. 1 qop 30 kg.',
    'Qop', 30,
    380000, 15, 437000, 437000,
    18, 18, 0, 5, 5, TRUE
  );

-- ============================================================
-- 8. TIZIM SOZLAMALARI (INITIAL SETTINGS)
-- ============================================================
INSERT INTO settings (key, value)
VALUES
  ('warehouse', '{"name": "KANKA Ulgurji Ombori", "phone": "+998910139595", "telegram": "@otaniyoz_lutfiyev", "default_markup": 15}'::JSONB)
ON CONFLICT (key) DO NOTHING;

-- TAYYOR! Barcha jadvallar va namunaviy ma'lumotlar yaratildi.
