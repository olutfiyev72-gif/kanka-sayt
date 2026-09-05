-- ============================================================
-- KANKA Warehouse Pre-Order System
-- Migration: 001_initial_schema.sql
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  image_url       TEXT,
  gallery_urls    TEXT[] DEFAULT '{}',
  weight_per_box  NUMERIC(10, 2) NOT NULL DEFAULT 10,
  unit_name       TEXT NOT NULL DEFAULT 'karopka',
  total_stock     INTEGER NOT NULL DEFAULT 0,
  available_stock INTEGER NOT NULL DEFAULT 0,
  reserved_stock  INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Optional price (hidden from public if null)
  price           NUMERIC(12, 2),
  -- SEO
  seo_title       TEXT,
  seo_description TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints to prevent negative stock
  CONSTRAINT chk_available_non_negative CHECK (available_stock >= 0),
  CONSTRAINT chk_reserved_non_negative  CHECK (reserved_stock >= 0),
  CONSTRAINT chk_total_non_negative     CHECK (total_stock >= 0),
  CONSTRAINT chk_stock_balance          CHECK (total_stock = available_stock + reserved_stock)
);

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone         TEXT NOT NULL,
  visit_time    TIMESTAMPTZ,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'NEW',
  total_boxes   INTEGER NOT NULL,
  total_weight  NUMERIC(10, 2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_order_status CHECK (status IN ('NEW','CONFIRMED','READY','COMPLETED','CANCELLED'))
);

-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id              UUID NOT NULL REFERENCES products(id),
  -- Snapshots (preserve data even if product changes)
  product_name_snapshot   TEXT NOT NULL,
  weight_per_box_snapshot NUMERIC(10, 2) NOT NULL,
  quantity_boxes          INTEGER NOT NULL,
  total_weight            NUMERIC(10, 2) NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_quantity_positive CHECK (quantity_boxes > 0)
);

-- ============================================================
-- TABLE: stock_movements (History log)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id),
  movement_type     TEXT NOT NULL,
  -- Quantity (always positive; direction is in movement_type)
  quantity          INTEGER NOT NULL,
  -- Snapshots before/after
  previous_available INTEGER NOT NULL,
  new_available      INTEGER NOT NULL,
  previous_total    INTEGER NOT NULL,
  new_total         INTEGER NOT NULL,
  reason            TEXT,
  order_id          UUID REFERENCES orders(id),
  admin_user_id     UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_movement_type CHECK (movement_type IN ('IN','OUT','RESERVE','RELEASE','ADJUSTMENT'))
);

-- ============================================================
-- TABLE: app_settings (Key-value store)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO app_settings (key, value) VALUES
  ('company_name', 'KANKA'),
  ('phone', '+998 90 000 00 00'),
  ('telegram_url', 'https://t.me/otaniyoz_lutfiyev'),
  ('warehouse_address', 'Toshkent shahar, ...'),
  ('working_hours', 'Dushanba–Shanba: 09:00–18:00'),
  ('low_stock_default_threshold', '5'),
  ('telegram_bot_token', ''),
  ('telegram_chat_id', '')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEQUENCE: Order number generator
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS order_number_seq
  START WITH 1000
  INCREMENT BY 1
  NO CYCLE;

-- Function to get next order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- CRITICAL: Atomic Stock Reservation Function
-- This runs as a single transaction with row-level locking
-- to prevent overselling (race condition safe)
-- ============================================================
CREATE OR REPLACE FUNCTION create_order_atomic(
  p_customer_name TEXT,
  p_phone         TEXT,
  p_visit_time    TIMESTAMPTZ DEFAULT NULL,
  p_note          TEXT DEFAULT NULL,
  p_items         JSONB DEFAULT '[]'  -- [{product_id: uuid, quantity_boxes: int}]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id      UUID;
  v_order_number  TEXT;
  v_total_boxes   INTEGER := 0;
  v_total_weight  NUMERIC := 0;
  v_item          JSONB;
  v_product       RECORD;
  v_product_id    UUID;
  v_qty           INTEGER;
  v_result        JSONB;
BEGIN
  -- Validate items not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must have at least one item' USING ERRCODE = 'P0001';
  END IF;

  -- --------------------------------------------------------
  -- STEP 1: Lock all products in deterministic order (FOR UPDATE)
  -- to prevent deadlocks and race conditions, and validate available stock
  -- --------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'quantity_boxes')::INTEGER;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for product %', v_product_id USING ERRCODE = 'P0002';
    END IF;

    -- Lock the row and get current stock
    SELECT id, name, available_stock, weight_per_box, is_active
    INTO v_product
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;  -- ROW-LEVEL LOCK

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id USING ERRCODE = 'P0003';
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product is not active: %', v_product.name USING ERRCODE = 'P0004';
    END IF;

    IF v_product.available_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
        v_product.name, v_product.available_stock, v_qty
        USING ERRCODE = 'P0005';
    END IF;

    -- Accumulate totals
    v_total_boxes  := v_total_boxes + v_qty;
    v_total_weight := v_total_weight + (v_qty * v_product.weight_per_box);
  END LOOP;

  -- --------------------------------------------------------
  -- STEP 2: Generate order number and create order
  -- --------------------------------------------------------
  v_order_number := generate_order_number();
  v_order_id     := gen_random_uuid();

  INSERT INTO orders (
    id, order_number, customer_name, phone,
    visit_time, note, status, total_boxes, total_weight
  ) VALUES (
    v_order_id, v_order_number, p_customer_name, p_phone,
    p_visit_time, p_note, 'NEW', v_total_boxes, v_total_weight
  );

  -- --------------------------------------------------------
  -- STEP 3: Process each item, update stock, create movements
  -- --------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'quantity_boxes')::INTEGER;

    -- Get product info (already locked above, re-fetch for snapshot)
    SELECT id, name, weight_per_box, available_stock, reserved_stock, total_stock
    INTO v_product
    FROM products
    WHERE id = v_product_id;

    -- Create order item (snapshot product data)
    INSERT INTO order_items (
      order_id, product_id,
      product_name_snapshot, weight_per_box_snapshot,
      quantity_boxes, total_weight
    ) VALUES (
      v_order_id, v_product_id,
      v_product.name, v_product.weight_per_box,
      v_qty, v_qty * v_product.weight_per_box
    );

    -- Update stock: available ↓, reserved ↑
    UPDATE products SET
      available_stock = available_stock - v_qty,
      reserved_stock  = reserved_stock  + v_qty
    WHERE id = v_product_id;

    -- Log stock movement
    INSERT INTO stock_movements (
      product_id, movement_type, quantity,
      previous_available, new_available,
      previous_total, new_total,
      reason, order_id
    ) VALUES (
      v_product_id, 'RESERVE', v_qty,
      v_product.available_stock, v_product.available_stock - v_qty,
      v_product.total_stock, v_product.total_stock,
      'Order ' || v_order_number, v_order_id
    );
  END LOOP;

  -- --------------------------------------------------------
  -- STEP 4: Return result
  -- --------------------------------------------------------
  v_result := jsonb_build_object(
    'success',      true,
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'total_boxes',  v_total_boxes,
    'total_weight', v_total_weight
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Entire transaction rolls back automatically
    RETURN jsonb_build_object(
      'success', false,
      'error',   SQLERRM,
      'code',    SQLSTATE
    );
END;
$$;

-- ============================================================
-- FUNCTION: Release stock on order cancellation
-- ============================================================
CREATE OR REPLACE FUNCTION release_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_product RECORD;
BEGIN
  FOR v_item IN
    SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    SELECT available_stock, reserved_stock, total_stock
    INTO v_product
    FROM products WHERE id = v_item.product_id
    FOR UPDATE;

    -- Return reserved to available
    UPDATE products SET
      available_stock = available_stock + v_item.quantity_boxes,
      reserved_stock  = reserved_stock  - v_item.quantity_boxes
    WHERE id = v_item.product_id;

    -- Log movement
    INSERT INTO stock_movements (
      product_id, movement_type, quantity,
      previous_available, new_available,
      previous_total, new_total,
      reason, order_id
    ) VALUES (
      v_item.product_id, 'RELEASE', v_item.quantity_boxes,
      v_product.available_stock, v_product.available_stock + v_item.quantity_boxes,
      v_product.total_stock, v_product.total_stock,
      'Order cancelled', p_order_id
    );
  END LOOP;
END;
$$;

-- ============================================================
-- FUNCTION: Finalize stock on order completion
-- ============================================================
CREATE OR REPLACE FUNCTION complete_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_product RECORD;
BEGIN
  FOR v_item IN
    SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    SELECT available_stock, reserved_stock, total_stock
    INTO v_product
    FROM products WHERE id = v_item.product_id
    FOR UPDATE;

    -- Remove from reserved AND total (goods physically left warehouse)
    UPDATE products SET
      reserved_stock = reserved_stock - v_item.quantity_boxes,
      total_stock    = total_stock    - v_item.quantity_boxes
    WHERE id = v_item.product_id;

    -- Log movement
    INSERT INTO stock_movements (
      product_id, movement_type, quantity,
      previous_available, new_available,
      previous_total, new_total,
      reason, order_id
    ) VALUES (
      v_item.product_id, 'OUT', v_item.quantity_boxes,
      v_product.available_stock, v_product.available_stock,
      v_product.total_stock, v_product.total_stock - v_item.quantity_boxes,
      'Order completed - goods dispatched', p_order_id
    );
  END LOOP;
END;
$$;

-- ============================================================
-- INDEXES (Performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_slug      ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone       ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings    ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------
-- products: Public can read active products only
-- -----------------------------------------------
CREATE POLICY "public_read_active_products"
  ON products FOR SELECT
  USING (is_active = TRUE);

-- Admin (service role) can do everything
CREATE POLICY "admin_all_products"
  ON products FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- -----------------------------------------------
-- orders: Public can INSERT (place order)
--         Public cannot read other people's orders
--         Admin can read all
-- -----------------------------------------------
CREATE POLICY "public_create_order"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

CREATE POLICY "admin_all_orders"
  ON orders FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- -----------------------------------------------
-- order_items: Same pattern as orders
-- -----------------------------------------------
CREATE POLICY "admin_all_order_items"
  ON order_items FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Public can insert (via atomic function with service role anyway)
CREATE POLICY "public_insert_order_items"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

-- -----------------------------------------------
-- stock_movements: Admin only
-- -----------------------------------------------
CREATE POLICY "admin_all_stock_movements"
  ON stock_movements FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- -----------------------------------------------
-- app_settings: Public read (for company info)
--               Admin write
-- -----------------------------------------------
CREATE POLICY "public_read_settings"
  ON app_settings FOR SELECT
  USING (key NOT IN ('telegram_bot_token', 'telegram_chat_id'));

CREATE POLICY "admin_all_settings"
  ON app_settings FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
