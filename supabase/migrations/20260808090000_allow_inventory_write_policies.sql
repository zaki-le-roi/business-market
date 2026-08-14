/*
# Ensure warehouses, inventory_levels, inventory_movements, suppliers, supplier_purchase_orders, product_variants have all required columns and RLS policies
*/

-- 1. Warehouses Table Columns & RLS
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

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS name_fr TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS wilaya_id INT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS manager_name TEXT DEFAULT '';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT false;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouses_select_public" ON warehouses;
CREATE POLICY "warehouses_select_public" ON warehouses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "warehouses_write_authenticated" ON warehouses;
DROP POLICY IF EXISTS "warehouses_write_all" ON warehouses;
CREATE POLICY "warehouses_write_policy" ON warehouses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 2. Inventory Levels Table Columns & RLS
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

ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS damaged_quantity INT DEFAULT 0;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS rack_location TEXT DEFAULT '';
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_levels_select_public" ON inventory_levels;
CREATE POLICY "inventory_levels_select_public" ON inventory_levels FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "inventory_levels_write_authenticated" ON inventory_levels;
DROP POLICY IF EXISTS "inventory_levels_write_all" ON inventory_levels;
CREATE POLICY "inventory_levels_write_policy" ON inventory_levels FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 3. Inventory Movements Table Columns & RLS
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    target_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL,
    quantity_change INT NOT NULL,
    previous_stock INT NOT NULL DEFAULT 0,
    new_stock INT NOT NULL DEFAULT 0,
    reference_number TEXT DEFAULT '',
    created_by TEXT DEFAULT 'Admin',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS previous_stock INT DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS new_stock INT DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference_number TEXT DEFAULT '';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'Admin';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_movements_select_public" ON inventory_movements;
CREATE POLICY "inventory_movements_select_public" ON inventory_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "inventory_movements_write_authenticated" ON inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_write_all" ON inventory_movements;
CREATE POLICY "inventory_movements_write_policy" ON inventory_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 4. Suppliers Table
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

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_select_public" ON suppliers;
CREATE POLICY "suppliers_select_public" ON suppliers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "suppliers_write_all" ON suppliers;
CREATE POLICY "suppliers_write_policy" ON suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 5. Supplier Purchase Orders Table
CREATE TABLE IF NOT EXISTS supplier_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT NOT NULL UNIQUE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'draft',
    items JSONB DEFAULT '[]'::jsonb,
    total_cost NUMERIC(12, 2) DEFAULT 0,
    expected_delivery_date TIMESTAMPTZ,
    notes TEXT DEFAULT '',
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE supplier_purchase_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE supplier_purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE supplier_purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supplier_purchase_orders_select_public" ON supplier_purchase_orders;
CREATE POLICY "supplier_purchase_orders_select_public" ON supplier_purchase_orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "supplier_purchase_orders_write_all" ON supplier_purchase_orders;
CREATE POLICY "supplier_purchase_orders_write_policy" ON supplier_purchase_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 6. Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    options JSONB DEFAULT '{}'::jsonb,
    price_override NUMERIC(10, 2),
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_variants_select_public" ON product_variants;
CREATE POLICY "product_variants_select_public" ON product_variants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "product_variants_write_all" ON product_variants;
CREATE POLICY "product_variants_write_policy" ON product_variants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
