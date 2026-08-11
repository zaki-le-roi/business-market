/*
# Schema fix & expansion for Warehouses, Inventory, Shipping, and Settings
Ensures all required columns (e.g. updated_at, code, is_main, is_active) exist on `warehouses`
and other inventory/shipping/settings tables.
*/

-- 1. Warehouses Table Ensure Columns
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
CREATE POLICY "warehouses_select_public" ON warehouses FOR SELECT USING (true);

DROP POLICY IF EXISTS "warehouses_write_authenticated" ON warehouses;
CREATE POLICY "warehouses_write_authenticated" ON warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default Main Warehouse if none exists
INSERT INTO warehouses (code, name_ar, name_fr, is_main, is_active)
VALUES ('WH-MAIN', 'المستودع الرئيسي', 'Entrepôt Principal', true, true)
ON CONFLICT (code) DO NOTHING;

-- 2. Inventory Levels Table Ensure Columns
CREATE TABLE IF NOT EXISTS inventory_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 0,
    damaged_quantity INT NOT NULL DEFAULT 0,
    rack_location TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, variant_id, warehouse_id)
);

ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS damaged_quantity INT DEFAULT 0;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS rack_location TEXT DEFAULT '';
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_levels_select_public" ON inventory_levels;
CREATE POLICY "inventory_levels_select_public" ON inventory_levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_levels_write_authenticated" ON inventory_levels;
CREATE POLICY "inventory_levels_write_authenticated" ON inventory_levels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Inventory Movements Table Ensure Columns
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

ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'Admin';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_movements_select_public" ON inventory_movements;
CREATE POLICY "inventory_movements_select_public" ON inventory_movements FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_movements_write_authenticated" ON inventory_movements;
CREATE POLICY "inventory_movements_write_authenticated" ON inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Store Settings Table
CREATE TABLE IF NOT EXISTS store_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    store_name_ar TEXT DEFAULT 'بيزنس ماركت',
    store_name_fr TEXT DEFAULT 'Business Market',
    store_name_en TEXT DEFAULT 'Business Market',
    default_language TEXT DEFAULT 'ar',
    default_currency TEXT DEFAULT 'DZD',
    store_phone TEXT DEFAULT '',
    store_email TEXT DEFAULT '',
    store_address TEXT DEFAULT '',
    store_logo TEXT DEFAULT '',
    maintenance_mode BOOLEAN DEFAULT false,
    ai_chatbot_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_settings_select_public" ON store_settings;
CREATE POLICY "store_settings_select_public" ON store_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "store_settings_write_authenticated" ON store_settings;
CREATE POLICY "store_settings_write_authenticated" ON store_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO store_settings (id, store_name_ar, store_name_fr, store_name_en, default_language, default_currency)
VALUES (1, 'بيزنس ماركت', 'Business Market', 'Business Market', 'ar', 'DZD')
ON CONFLICT (id) DO NOTHING;

-- 5. Shipping Providers Table
CREATE TABLE IF NOT EXISTS shipping_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    logo_url TEXT DEFAULT '',
    base_url TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    supports_home_delivery BOOLEAN DEFAULT true,
    supports_stop_desk BOOLEAN DEFAULT true,
    supports_cod BOOLEAN DEFAULT true,
    tracking_url_template TEXT DEFAULT '',
    api_key TEXT DEFAULT '',
    api_secret TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shipping_providers ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';
ALTER TABLE shipping_providers ADD COLUMN IF NOT EXISTS base_url TEXT DEFAULT '';
ALTER TABLE shipping_providers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE shipping_providers ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE shipping_providers ADD COLUMN IF NOT EXISTS supports_home_delivery BOOLEAN DEFAULT true;
ALTER TABLE shipping_providers ADD COLUMN IF NOT EXISTS supports_stop_desk BOOLEAN DEFAULT true;
ALTER TABLE shipping_providers ADD COLUMN IF NOT EXISTS supports_cod BOOLEAN DEFAULT true;
ALTER TABLE shipping_providers ADD COLUMN IF NOT EXISTS tracking_url_template TEXT DEFAULT '';

ALTER TABLE shipping_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_providers_select_public" ON shipping_providers;
CREATE POLICY "shipping_providers_select_public" ON shipping_providers FOR SELECT USING (true);

DROP POLICY IF EXISTS "shipping_providers_write_authenticated" ON shipping_providers;
CREATE POLICY "shipping_providers_write_authenticated" ON shipping_providers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Shipping Rates Table
CREATE TABLE IF NOT EXISTS shipping_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE CASCADE,
    wilaya_id INT NOT NULL,
    home_fee NUMERIC(10, 2) NOT NULL DEFAULT 600,
    desk_fee NUMERIC(10, 2) NOT NULL DEFAULT 400,
    return_fee NUMERIC(10, 2) NOT NULL DEFAULT 200,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(provider_id, wilaya_id)
);

ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_rates_select_public" ON shipping_rates;
CREATE POLICY "shipping_rates_select_public" ON shipping_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "shipping_rates_write_authenticated" ON shipping_rates;
CREATE POLICY "shipping_rates_write_authenticated" ON shipping_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
