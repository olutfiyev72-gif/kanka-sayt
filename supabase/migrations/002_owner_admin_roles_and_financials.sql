-- ============================================================
-- Migration: 002_owner_admin_roles_and_financials.sql
-- KANKA — Enterprise Roles, Financial Isolation & Historical Snapshot
-- ============================================================

-- 1. Extend products table with SKU, Category, Cost Price, Selling Price, Minimum Stock
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Umumiy',
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_stock INTEGER DEFAULT 5;

-- Sync initial selling_price with price if null
UPDATE products
SET selling_price = COALESCE(price, 0),
    minimum_stock = COALESCE(low_stock_threshold, 5)
WHERE selling_price = 0 OR selling_price IS NULL;

-- 2. Extend order_items with Historical Cost Snapshots
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_cost_at_sale NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price_at_sale NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- 3. Extend orders with Financial Totals
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_profit NUMERIC(15, 2) DEFAULT 0;

-- 4. Extend stock_movements with actor, note, and updated movement types
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS actor TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Update movement type check constraint
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_movement_type;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_movement_type CHECK (
    movement_type IN (
      'INITIAL_STOCK', 'STOCK_IN', 'STOCK_OUT', 'SALE',
      'RESERVATION', 'RELEASE_RESERVATION', 'RETURN', 'DAMAGE',
      'ADJUSTMENT', 'IN', 'OUT', 'RESERVE', 'RELEASE'
    )
  );

-- 5. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT,
  old_value    JSONB,
  new_value    JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_audit_logs"
  ON audit_logs FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- 6. Updated Atomic Order Creation Function with Historical Cost Snapshot
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
  -- Validate items not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must have at least one item' USING ERRCODE = 'P0001';
  END IF;

  -- --------------------------------------------------------
  -- STEP 1: Lock all products and validate stock
  -- --------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'quantity_boxes')::INTEGER;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for product %', v_product_id USING ERRCODE = 'P0002';
    END IF;

    SELECT id, name, available_stock, weight_per_box, is_active, cost_price, selling_price, price
    INTO v_product
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

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

    v_total_boxes  := v_total_boxes + v_qty;
    v_total_weight := v_total_weight + (v_qty * v_product.weight_per_box);
  END LOOP;

  -- --------------------------------------------------------
  -- STEP 2: Generate order ID & record
  -- --------------------------------------------------------
  v_order_number := generate_order_number();
  v_order_id     := gen_random_uuid();

  INSERT INTO orders (
    id, order_number, customer_name, phone,
    visit_time, note, status, total_boxes, total_weight,
    total_cost, total_revenue, total_profit
  ) VALUES (
    v_order_id, v_order_number, p_customer_name, p_phone,
    p_visit_time, p_note, 'NEW', v_total_boxes, v_total_weight,
    0, 0, 0
  );

  -- --------------------------------------------------------
  -- STEP 3: Process items with Historical Cost Snapshot
  -- --------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'quantity_boxes')::INTEGER;

    SELECT id, name, weight_per_box, available_stock, reserved_stock, total_stock,
           COALESCE(cost_price, 0) as cost_price,
           COALESCE(selling_price, price, 0) as selling_price
    INTO v_product
    FROM products
    WHERE id = v_product_id;

    v_item_cost     := v_product.cost_price;
    v_item_price    := v_product.selling_price;
    v_item_tot_cost := v_item_cost * v_qty;
    v_item_tot_rev  := v_item_price * v_qty;
    v_item_profit   := v_item_tot_rev - v_item_tot_cost;

    v_order_cost    := v_order_cost + v_item_tot_cost;
    v_order_revenue := v_order_revenue + v_item_tot_rev;
    v_order_profit  := v_order_profit + v_item_profit;

    -- Snapshot into order_items
    INSERT INTO order_items (
      order_id, product_id,
      product_name_snapshot, weight_per_box_snapshot,
      quantity_boxes, total_weight,
      unit_cost_at_sale, unit_price_at_sale,
      total_cost, total_revenue, gross_profit
    ) VALUES (
      v_order_id, v_product_id,
      v_product.name, v_product.weight_per_box,
      v_qty, v_qty * v_product.weight_per_box,
      v_item_cost, v_item_price,
      v_item_tot_cost, v_item_tot_rev, v_item_profit
    );

    -- Stock update
    UPDATE products SET
      available_stock = available_stock - v_qty,
      reserved_stock  = reserved_stock  + v_qty
    WHERE id = v_product_id;

    -- Stock movement log
    INSERT INTO stock_movements (
      product_id, movement_type, quantity,
      previous_available, new_available,
      previous_total, new_total,
      reason, note, actor, order_id
    ) VALUES (
      v_product_id, 'RESERVATION', v_qty,
      v_product.available_stock, v_product.available_stock - v_qty,
      v_product.total_stock, v_product.total_stock,
      'Order ' || v_order_number,
      'Order ' || v_order_number || ' band qilindi',
      'Customer (' || p_customer_name || ')',
      v_order_id
    );
  END LOOP;

  -- Update order totals with financial snapshot
  UPDATE orders SET
    total_cost    = v_order_cost,
    total_revenue = v_order_revenue,
    total_profit  = v_order_profit
  WHERE id = v_order_id;

  v_result := jsonb_build_object(
    'success',       true,
    'order_id',      v_order_id,
    'order_number',  v_order_number,
    'total_boxes',   v_total_boxes,
    'total_weight',  v_total_weight,
    'total_cost',    v_order_cost,
    'total_revenue', v_order_revenue,
    'total_profit',  v_order_profit
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   SQLERRM,
      'code',    SQLSTATE
    );
END;
$$;
