-- ============================================================
-- Migration: 003_sku_as_primary_identifier.sql
-- KANKA — SKU / Special Mark as Primary Business Identifier
-- ============================================================

-- 1. Backfill any null or empty SKUs with a unique format based on ID or existing name
UPDATE products
SET sku = UPPER(COALESCE(NULLIF(TRIM(sku), ''), 'PRD-' || SUBSTRING(id::text, 1, 8)))
WHERE sku IS NULL OR TRIM(sku) = '';

-- 2. Sync name = sku so that existing database constraints (name NOT NULL) remain satisfied
UPDATE products
SET name = sku
WHERE name != sku OR name IS NULL;

-- 3. Ensure sku is UNIQUE and NOT NULL
ALTER TABLE products
  ALTER COLUMN sku SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sku_unique'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_sku_unique UNIQUE (sku);
  END IF;
END $$;

-- 4. Set unit_name default to 'Qop'
ALTER TABLE products
  ALTER COLUMN unit_name SET DEFAULT 'Qop';

-- 5. Add sku_snapshot to order_items if not present
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS sku_snapshot TEXT;

-- Backfill sku_snapshot from products or product_name_snapshot
UPDATE order_items oi
SET sku_snapshot = COALESCE(p.sku, oi.product_name_snapshot)
FROM products p
WHERE oi.product_id = p.id AND (oi.sku_snapshot IS NULL OR oi.sku_snapshot = '');

-- 6. Update create_order_atomic to use SKU as snapshot
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

    SELECT id, sku, name, available_stock, weight_per_box, is_active, cost_price, selling_price, price
    INTO v_product
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id USING ERRCODE = 'P0003';
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Product is not active: %', COALESCE(v_product.sku, v_product.name) USING ERRCODE = 'P0004';
    END IF;

    IF v_product.available_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
        COALESCE(v_product.sku, v_product.name), v_product.available_stock, v_qty
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
  -- STEP 3: Process items with SKU Snapshot and Historical Cost
  -- --------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty        := (v_item->>'quantity_boxes')::INTEGER;

    SELECT id, sku, name, weight_per_box, available_stock, reserved_stock, total_stock,
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

    -- Snapshot into order_items with SKU
    INSERT INTO order_items (
      order_id, product_id,
      product_name_snapshot, sku_snapshot, weight_per_box_snapshot,
      quantity_boxes, total_weight,
      unit_cost_at_sale, unit_price_at_sale,
      total_cost, total_revenue, gross_profit
    ) VALUES (
      v_order_id, v_product_id,
      COALESCE(v_product.sku, v_product.name), COALESCE(v_product.sku, v_product.name), v_product.weight_per_box,
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
      'Pre-order reservation #' || v_order_number,
      'Mijoz: ' || p_customer_name || ' (' || p_phone || ') — SKU: ' || COALESCE(v_product.sku, v_product.name),
      'Client (' || p_customer_name || ')',
      v_order_id
    );
  END LOOP;

  -- --------------------------------------------------------
  -- STEP 4: Update order totals
  -- --------------------------------------------------------
  UPDATE orders SET
    total_cost    = v_order_cost,
    total_revenue = v_order_revenue,
    total_profit  = v_order_profit
  WHERE id = v_order_id;

  -- --------------------------------------------------------
  -- STEP 5: Return result
  -- --------------------------------------------------------
  SELECT jsonb_build_object(
    'success',      TRUE,
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'total_boxes',  v_total_boxes,
    'total_weight', v_total_weight,
    'total_cost',   v_order_cost,
    'total_revenue',v_order_revenue,
    'total_profit', v_order_profit,
    'status',       'NEW'
  ) INTO v_result;

  RETURN v_result;
END;
$$;
