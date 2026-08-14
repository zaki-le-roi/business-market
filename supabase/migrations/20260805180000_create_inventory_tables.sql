/*
# Create Inventory & Warehouse Management Tables, Triggers, and RPC Functions

## Tables Included:
1. `warehouses`: Physical and virtual warehouse locations.
2. `product_variants`: Product options, SKUs, and variant-specific inventory totals.
3. `inventory_levels`: Usable and damaged stock levels per product/variant/warehouse.
4. `inventory_movements`: Immutable log of all stock adjustments, transfers, deductions, and receipts.
5. `suppliers`: Vendor/supplier profiles for procurement.
6. `supplier_purchase_orders`: Purchase orders (POs) placed with suppliers for restocking.
*/

-- 1. Warehouses Table
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    wilaya_id INT,
    manager_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    is_main BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for warehouses
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouses_select_public" ON warehouses;
CREATE POLICY "warehouses_select_public" ON warehouses FOR SELECT USING (true);

DROP POLICY IF EXISTS "warehouses_all_authenticated" ON warehouses;
CREATE POLICY "warehouses_all_authenticated" ON warehouses FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- Seed default Main Warehouse if none exists
INSERT INTO warehouses (code, name_ar, name_fr, is_main, is_active)
VALUES ('WH-MAIN', 'المستودع الرئيسي', 'Entrepôt Principal', true, true)
ON CONFLICT (code) DO NOTHING;


-- 2. Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '{}'::jsonb,
    price_override NUMERIC(12, 2),
    stock_quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variants_select_public" ON product_variants;
CREATE POLICY "product_variants_select_public" ON product_variants FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_variants_all_authenticated" ON product_variants;
CREATE POLICY "product_variants_all_authenticated" ON product_variants FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);


-- 3. Inventory Levels Table
CREATE TABLE IF NOT EXISTS inventory_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 0,
    damaged_quantity INT NOT NULL DEFAULT 0,
    rack_location TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index to prevent duplicate inventory records for same product/variant/warehouse
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_levels_unique 
ON inventory_levels (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id);

-- Enable RLS for inventory_levels
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_levels_select_public" ON inventory_levels;
CREATE POLICY "inventory_levels_select_public" ON inventory_levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_levels_all_authenticated" ON inventory_levels;
CREATE POLICY "inventory_levels_all_authenticated" ON inventory_levels FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);


-- 4. Inventory Movements Table (Audit Log for all Stock Operations)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    target_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL, -- 'initial_seed', 'manual_adjustment', 'order_deduction', 'order_cancellation', 'order_refund', 'supplier_receipt', 'warehouse_transfer', 'damaged_loss', 'csv_bulk_update'
    quantity_change INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reference_number TEXT,
    created_by TEXT DEFAULT 'Admin',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for inventory_movements
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_movements_select_public" ON inventory_movements;
CREATE POLICY "inventory_movements_select_public" ON inventory_movements FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_movements_all_authenticated" ON inventory_movements;
CREATE POLICY "inventory_movements_all_authenticated" ON inventory_movements FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);


-- 5. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contact_person TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    payment_terms TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select_public" ON suppliers;
CREATE POLICY "suppliers_select_public" ON suppliers FOR SELECT USING (true);

DROP POLICY IF EXISTS "suppliers_all_authenticated" ON suppliers;
CREATE POLICY "suppliers_all_authenticated" ON suppliers FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);


-- 6. Supplier Purchase Orders Table
CREATE TABLE IF NOT EXISTS supplier_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'ordered', 'received', 'cancelled'
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_delivery_date TIMESTAMPTZ,
    notes TEXT,
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for supplier_purchase_orders
ALTER TABLE supplier_purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_purchase_orders_select_public" ON supplier_purchase_orders;
CREATE POLICY "supplier_purchase_orders_select_public" ON supplier_purchase_orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "supplier_purchase_orders_all_authenticated" ON supplier_purchase_orders;
CREATE POLICY "supplier_purchase_orders_all_authenticated" ON supplier_purchase_orders FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);


-- 7. Trigger & Function: Synchronize products.stock_quantity from inventory_levels
CREATE OR REPLACE FUNCTION sync_product_stock_from_inventory()
RETURNS TRIGGER AS $$
DECLARE
  target_prod_id UUID;
  total_qty INT;
BEGIN
  target_prod_id := COALESCE(NEW.product_id, OLD.product_id);
  
  -- Sum usable physical quantity across all warehouses for base product (where variant_id IS NULL)
  SELECT COALESCE(SUM(quantity), 0) INTO total_qty
  FROM inventory_levels
  WHERE product_id = target_prod_id AND variant_id IS NULL;

  UPDATE products
  SET stock_quantity = total_qty,
      updated_at = now()
  WHERE id = target_prod_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_product_stock ON inventory_levels;
CREATE TRIGGER trigger_sync_product_stock
AFTER INSERT OR UPDATE OR DELETE ON inventory_levels
FOR EACH ROW EXECUTE FUNCTION sync_product_stock_from_inventory();


-- 8. Initial Seeding of Existing Products into Main Warehouse
DO $$
DECLARE
  main_wh_id UUID;
  prod RECORD;
BEGIN
  SELECT id INTO main_wh_id FROM warehouses WHERE is_main = true LIMIT 1;
  IF main_wh_id IS NOT NULL THEN
    FOR prod IN SELECT id, stock_quantity FROM products LOOP
      IF NOT EXISTS (
        SELECT 1 FROM inventory_levels 
        WHERE product_id = prod.id 
          AND variant_id IS NULL 
          AND warehouse_id = main_wh_id
      ) THEN
        INSERT INTO inventory_levels (product_id, warehouse_id, quantity)
        VALUES (prod.id, main_wh_id, COALESCE(prod.stock_quantity, 0));

        INSERT INTO inventory_movements (
          product_id, warehouse_id, movement_type, 
          quantity_change, previous_stock, new_stock, 
          reference_number, created_by, notes
        ) VALUES (
          prod.id, main_wh_id, 'initial_seed', 
          COALESCE(prod.stock_quantity, 0), 0, COALESCE(prod.stock_quantity, 0), 
          'INIT-SYSTEM', 'System', 'Initial seed from product stock_quantity'
        );
      END IF;
    END LOOP;
  END IF;
END $$;


-- 9. Atomic RPC Functions for Safe Inventory Operations

-- A) Atomic Decrement Stock (Compatible with Storefront Checkout RPC)
CREATE OR REPLACE FUNCTION decrement_stock(product_id uuid, quantity int)
RETURNS void AS $$
DECLARE
  wh_id uuid;
  current_qty int := 0;
  new_qty int := 0;
BEGIN
  -- Get main warehouse or warehouse with highest quantity
  SELECT warehouse_id, quantity INTO wh_id, current_qty
  FROM inventory_levels
  WHERE inventory_levels.product_id = decrement_stock.product_id AND variant_id IS NULL
  ORDER BY quantity DESC
  LIMIT 1;

  IF wh_id IS NULL THEN
    SELECT id INTO wh_id FROM warehouses WHERE is_main = true LIMIT 1;
    current_qty := 0;
  END IF;

  new_qty := GREATEST(0, COALESCE(current_qty, 0) - quantity);

  IF EXISTS (
    SELECT 1 FROM inventory_levels 
    WHERE inventory_levels.product_id = decrement_stock.product_id 
      AND variant_id IS NULL 
      AND warehouse_id = wh_id
  ) THEN
    UPDATE inventory_levels
    SET quantity = new_qty, updated_at = now()
    WHERE inventory_levels.product_id = decrement_stock.product_id 
      AND variant_id IS NULL 
      AND warehouse_id = wh_id;
  ELSE
    INSERT INTO inventory_levels (product_id, warehouse_id, quantity)
    VALUES (decrement_stock.product_id, wh_id, new_qty);
  END IF;

  -- Log movement
  INSERT INTO inventory_movements (
    product_id, warehouse_id, movement_type, 
    quantity_change, previous_stock, new_stock, 
    reference_number, created_by, notes
  ) VALUES (
    decrement_stock.product_id, wh_id, 'order_deduction', 
    -quantity, COALESCE(current_qty, 0), new_qty, 
    'ONLINE-ORDER', 'Storefront Checkout', 'Automatic order stock deduction'
  );

  -- Increment sales_count on products
  UPDATE products SET sales_count = COALESCE(sales_count, 0) + quantity WHERE id = decrement_stock.product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B) Atomic Stock Adjustment RPC for Admin Operations
CREATE OR REPLACE FUNCTION adjust_inventory_level(
  p_product_id uuid,
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_qty_change int,
  p_movement_type text,
  p_ref text DEFAULT NULL,
  p_actor text DEFAULT 'Admin',
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  current_qty int := 0;
  new_qty int := 0;
  v_var_id uuid := p_variant_id;
BEGIN
  SELECT quantity INTO current_qty
  FROM inventory_levels
  WHERE product_id = p_product_id 
    AND (variant_id IS NOT DISTINCT FROM v_var_id)
    AND warehouse_id = p_warehouse_id;

  current_qty := COALESCE(current_qty, 0);
  new_qty := GREATEST(0, current_qty + p_qty_change);

  IF EXISTS (
    SELECT 1 FROM inventory_levels 
    WHERE product_id = p_product_id 
      AND (variant_id IS NOT DISTINCT FROM v_var_id) 
      AND warehouse_id = p_warehouse_id
  ) THEN
    UPDATE inventory_levels
    SET quantity = new_qty, updated_at = now()
    WHERE product_id = p_product_id 
      AND (variant_id IS NOT DISTINCT FROM v_var_id) 
      AND warehouse_id = p_warehouse_id;
  ELSE
    INSERT INTO inventory_levels (product_id, variant_id, warehouse_id, quantity)
    VALUES (p_product_id, v_var_id, p_warehouse_id, new_qty);
  END IF;

  -- Log Movement
  INSERT INTO inventory_movements (
    product_id, variant_id, warehouse_id, movement_type, 
    quantity_change, previous_stock, new_stock, reference_number, created_by, notes
  ) VALUES (
    p_product_id, v_var_id, p_warehouse_id, p_movement_type,
    p_qty_change, current_qty, new_qty, p_ref, p_actor, p_notes
  );

  -- If variant_id is provided, sync variant stock_quantity
  IF v_var_id IS NOT NULL THEN
    UPDATE product_variants
    SET stock_quantity = (
      SELECT COALESCE(SUM(quantity), 0) 
      FROM inventory_levels 
      WHERE variant_id = v_var_id
    ), updated_at = now()
    WHERE id = v_var_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'previous_stock', current_qty, 'new_stock', new_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C) Atomic Stock Transfer between Warehouses
CREATE OR REPLACE FUNCTION transfer_inventory_between_warehouses(
  p_product_id uuid,
  p_variant_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_transfer_qty int,
  p_actor text DEFAULT 'Admin',
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  from_qty int := 0;
  to_qty int := 0;
  v_var_id uuid := p_variant_id;
BEGIN
  IF p_transfer_qty <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than 0');
  END IF;

  SELECT quantity INTO from_qty
  FROM inventory_levels
  WHERE product_id = p_product_id 
    AND (variant_id IS NOT DISTINCT FROM v_var_id)
    AND warehouse_id = p_from_warehouse_id;

  from_qty := COALESCE(from_qty, 0);

  IF from_qty < p_transfer_qty THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock in source warehouse');
  END IF;

  -- Deduct from Source Warehouse
  UPDATE inventory_levels
  SET quantity = from_qty - p_transfer_qty, updated_at = now()
  WHERE product_id = p_product_id 
    AND (variant_id IS NOT DISTINCT FROM v_var_id)
    AND warehouse_id = p_from_warehouse_id;

  -- Add to Target Warehouse
  SELECT quantity INTO to_qty
  FROM inventory_levels
  WHERE product_id = p_product_id 
    AND (variant_id IS NOT DISTINCT FROM v_var_id)
    AND warehouse_id = p_to_warehouse_id;

  to_qty := COALESCE(to_qty, 0);

  IF EXISTS (
    SELECT 1 FROM inventory_levels 
    WHERE product_id = p_product_id 
      AND (variant_id IS NOT DISTINCT FROM v_var_id)
      AND warehouse_id = p_to_warehouse_id
  ) THEN
    UPDATE inventory_levels
    SET quantity = to_qty + p_transfer_qty, updated_at = now()
    WHERE product_id = p_product_id 
      AND (variant_id IS NOT DISTINCT FROM v_var_id)
      AND warehouse_id = p_to_warehouse_id;
  ELSE
    INSERT INTO inventory_levels (product_id, variant_id, warehouse_id, quantity)
    VALUES (p_product_id, v_var_id, p_to_warehouse_id, p_transfer_qty);
  END IF;

  -- Log Transfer Movement
  INSERT INTO inventory_movements (
    product_id, variant_id, warehouse_id, target_warehouse_id, movement_type,
    quantity_change, previous_stock, new_stock, reference_number, created_by, notes
  ) VALUES (
    p_product_id, v_var_id, p_from_warehouse_id, p_to_warehouse_id, 'warehouse_transfer',
    -p_transfer_qty, from_qty, from_qty - p_transfer_qty, 'WH-TRANSFER', p_actor, p_notes
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
