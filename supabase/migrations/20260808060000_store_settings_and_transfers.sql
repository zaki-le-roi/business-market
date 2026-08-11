/*
# Store Settings & Inventory Transfers Schema
Ensures `store_settings` table exists for global language, currency, and store settings,
and ensures `inventory_transfers` table exists for explicit transfer tracking.
*/

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
CREATE POLICY "store_settings_write_authenticated" ON store_settings FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO store_settings (id, store_name_ar, store_name_fr, store_name_en, default_language, default_currency)
VALUES (1, 'بيزنس ماركت', 'Business Market', 'Business Market', 'ar', 'DZD')
ON CONFLICT (id) DO NOTHING;

-- Inventory Transfers Table
CREATE TABLE IF NOT EXISTS inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT NOT NULL UNIQUE,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    to_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'completed', -- 'draft', 'in_transit', 'completed', 'cancelled'
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_transfers_select_public" ON inventory_transfers;
CREATE POLICY "inventory_transfers_select_public" ON inventory_transfers FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_transfers_write_authenticated" ON inventory_transfers;
CREATE POLICY "inventory_transfers_write_authenticated" ON inventory_transfers FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
