/*
# Module 5 — Shipping & Logistics Database Migration

## Tables Created/Ensured:
1. `shipping_providers`: Carrier definitions (Yalidine, ZR Express, EcoTrack, Maystro, Kazi Tour, Fleet).
2. `shipping_rates`: Per-wilaya (58 wilayas) pricing matrix for Home and Stop Desk delivery.
3. `shipping_manifests`: Carrier dispatch manifests.
4. `shipments`: 1-to-1 linkage with orders, tracking carrier refs, COD status, labels.
5. `shipment_tracking_events`: Immutable carrier tracking history.
6. `treasury_accounts`: Treasury / Cash drawer / Bank accounts for COD settlements.
7. `cod_settlements` & `cod_settlement_items`: Carrier payout reconciliation.
8. `shipping_settings`: Global shipping configuration & free shipping thresholds.

## RPC Functions:
1. `process_shipment_status_change`: Idempotent status change, tracking log, order sync & inventory restoration.
2. `reconcile_cod_settlement`: Idempotent COD settlement deposit into treasury accounts and finance payments.
3. `calculate_order_shipping_fee`: Dynamic rate calculator considering 58 wilayas and free shipping rules.
*/

-- 1. Create Treasury Accounts Table if not exists
CREATE TABLE IF NOT EXISTS treasury_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'cash_drawer', -- 'cash_drawer', 'bank', 'postal_ccp', 'carrier_settlement'
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'DZD',
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE treasury_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "treasury_accounts_all" ON treasury_accounts;
CREATE POLICY "treasury_accounts_all" ON treasury_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed Default Treasury Accounts
INSERT INTO treasury_accounts (code, name_ar, name_fr, account_type, balance)
VALUES 
  ('TREASURY-CASH', 'الخزينة الرئيسية (Caisse)', 'Caisse Principale', 'cash_drawer', 0),
  ('TREASURY-YALIDINE', 'حساب التسويه ياليدين', 'Compte Yalidine COD', 'carrier_settlement', 0),
  ('TREASURY-CCP', 'الحساب البريدي CCP', 'Compte CCP', 'postal_ccp', 0)
ON CONFLICT (code) DO NOTHING;


-- 2. Create Shipping Providers Table
CREATE TABLE IF NOT EXISTS shipping_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    supports_home_delivery BOOLEAN DEFAULT true,
    supports_stop_desk BOOLEAN DEFAULT true,
    supports_cod BOOLEAN DEFAULT true,
    supports_tracking BOOLEAN DEFAULT true,
    supports_automated_manifest BOOLEAN DEFAULT true,
    api_endpoint TEXT,
    tracking_url_template TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shipping_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_providers_read_all" ON shipping_providers;
CREATE POLICY "shipping_providers_read_all" ON shipping_providers FOR SELECT USING (true);

DROP POLICY IF EXISTS "shipping_providers_write_admin" ON shipping_providers;
CREATE POLICY "shipping_providers_write_admin" ON shipping_providers FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed Carrier Providers
INSERT INTO shipping_providers (code, name_ar, name_fr, is_active, is_default, supports_home_delivery, supports_stop_desk, tracking_url_template)
VALUES
  ('yalidine', 'ياليدين اكسبريس', 'Yalidine Express', true, true, true, true, 'https://yalidine.app/tracking/?tracking={tracking}'),
  ('zr_express', 'زد أار اكسبريس', 'ZR Express', true, false, true, true, 'https://zrexpress.com/tracking?id={tracking}'),
  ('ecotrack', 'إيكوتراك', 'EcoTrack', true, false, true, true, 'https://ecotrack.dz/tracking/{tracking}'),
  ('maystro', 'مايسترو دليفري', 'Maystro Delivery', true, false, true, true, 'https://maystro-delivery.com/track/{tracking}'),
  ('kazi_tour', 'قاضي تور', 'Kazi Tour', true, false, true, true, 'https://kazitour.dz/track/{tracking}'),
  ('internal_fleet', 'الأسطول الخاص', 'Flotte Interne', true, false, true, false, '')
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_fr = EXCLUDED.name_fr,
  supports_home_delivery = EXCLUDED.supports_home_delivery,
  supports_stop_desk = EXCLUDED.supports_stop_desk;


-- 3. Create Shipping Rates Table
CREATE TABLE IF NOT EXISTS shipping_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE CASCADE,
    wilaya_id INT NOT NULL REFERENCES wilayas(id) ON DELETE CASCADE,
    home_fee NUMERIC(12, 2) NOT NULL DEFAULT 600,
    desk_fee NUMERIC(12, 2) NOT NULL DEFAULT 400,
    return_fee NUMERIC(12, 2) NOT NULL DEFAULT 200,
    estimated_delivery_days_min INT DEFAULT 1,
    estimated_delivery_days_max INT DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    free_shipping_threshold NUMERIC(12, 2) DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (provider_id, wilaya_id)
);

ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_rates_read_all" ON shipping_rates;
CREATE POLICY "shipping_rates_read_all" ON shipping_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "shipping_rates_write_admin" ON shipping_rates;
CREATE POLICY "shipping_rates_write_admin" ON shipping_rates FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed Default Rates for all 58 Wilayas for Default Provider (Yalidine)
DO $$
DECLARE
  v_provider_id UUID;
  v_wilaya RECORD;
  v_home NUMERIC(12,2);
  v_desk NUMERIC(12,2);
BEGIN
  SELECT id INTO v_provider_id FROM shipping_providers WHERE code = 'yalidine' LIMIT 1;
  IF v_provider_id IS NOT NULL THEN
    FOR v_wilaya IN SELECT id, delivery_fee FROM wilayas LOOP
      -- Zone pricing logic: Alger (16) cheaper, nearby wilayas medium, far south higher
      IF v_wilaya.id = 16 THEN
        v_home := 400; v_desk := 250;
      ELSIF v_wilaya.id IN (9, 31, 25, 19, 35, 42) THEN
        v_home := 600; v_desk := 400;
      ELSIF v_wilaya.id IN (1, 11, 30, 33, 37, 39, 47) THEN
        v_home := 900; v_desk := 650;
      ELSIF v_wilaya.id IN (50, 51, 52, 53, 54, 55, 56, 57, 58) THEN
        v_home := 1200; v_desk := 900;
      ELSE
        v_home := COALESCE(v_wilaya.delivery_fee, 700);
        v_desk := GREATEST(200, v_home - 200);
      END IF;

      INSERT INTO shipping_rates (provider_id, wilaya_id, home_fee, desk_fee, return_fee)
      VALUES (v_provider_id, v_wilaya.id, v_home, v_desk, 200)
      ON CONFLICT (provider_id, wilaya_id) DO UPDATE SET
        home_fee = EXCLUDED.home_fee,
        desk_fee = EXCLUDED.desk_fee;
    END LOOP;
  END IF;
END $$;


-- 4. Create Shipping Settings Table
CREATE TABLE IF NOT EXISTS shipping_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    default_provider_id UUID REFERENCES shipping_providers(id),
    free_shipping_min_amount NUMERIC(12, 2) DEFAULT 10000,
    enable_home_delivery BOOLEAN DEFAULT true,
    enable_stop_desk BOOLEAN DEFAULT true,
    default_origin_wilaya_id INT DEFAULT 16,
    default_origin_address TEXT DEFAULT 'Alger, Algérie',
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shipping_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_settings_read_all" ON shipping_settings;
CREATE POLICY "shipping_settings_read_all" ON shipping_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "shipping_settings_write_admin" ON shipping_settings;
CREATE POLICY "shipping_settings_write_admin" ON shipping_settings FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DO $$
DECLARE
  v_p_id UUID;
BEGIN
  SELECT id INTO v_p_id FROM shipping_providers WHERE code = 'yalidine' LIMIT 1;
  INSERT INTO shipping_settings (id, default_provider_id, free_shipping_min_amount, enable_home_delivery, enable_stop_desk, default_origin_wilaya_id)
  VALUES (1, v_p_id, 10000, true, true, 16)
  ON CONFLICT (id) DO UPDATE SET default_provider_id = COALESCE(shipping_settings.default_provider_id, EXCLUDED.default_provider_id);
END $$;


-- 5. Create Shipping Manifests Table
CREATE TABLE IF NOT EXISTS shipping_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_number TEXT UNIQUE NOT NULL,
    provider_id UUID REFERENCES shipping_providers(id) ON DELETE RESTRICT,
    status TEXT CHECK (status IN ('draft', 'generated', 'submitted', 'picked_up', 'closed', 'cancelled')) DEFAULT 'draft',
    order_count INT DEFAULT 0,
    total_cod_amount NUMERIC(12, 2) DEFAULT 0,
    driver_name TEXT,
    driver_phone TEXT,
    vehicle_plate TEXT,
    created_by TEXT DEFAULT 'Admin',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shipping_manifests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_manifests_read_authenticated" ON shipping_manifests;
CREATE POLICY "shipping_manifests_read_authenticated" ON shipping_manifests FOR SELECT USING (true);

DROP POLICY IF EXISTS "shipping_manifests_write_authenticated" ON shipping_manifests;
CREATE POLICY "shipping_manifests_write_authenticated" ON shipping_manifests FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);


-- 6. Create Shipments Table (1-to-1 with Orders)
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
    manifest_id UUID REFERENCES shipping_manifests(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES shipping_providers(id) ON DELETE RESTRICT,
    tracking_number TEXT UNIQUE,
    carrier_ref_id TEXT,
    delivery_type TEXT CHECK (delivery_type IN ('home', 'stop_desk')) DEFAULT 'home',
    stop_desk_id TEXT,
    stop_desk_name TEXT,
    shipping_fee NUMERIC(12, 2) DEFAULT 0,
    cod_amount NUMERIC(12, 2) DEFAULT 0,
    cod_collected_amount NUMERIC(12, 2) DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'prepared', 'manifested', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned', 'cancelled')) DEFAULT 'pending',
    carrier_status_raw TEXT,
    cod_status TEXT CHECK (cod_status IN ('pending', 'collected_by_courier', 'transferred', 'settled', 'failed', 'refunded')) DEFAULT 'pending',
    recipient_name TEXT,
    recipient_phone TEXT,
    recipient_wilaya_id INT REFERENCES wilayas(id),
    recipient_commune TEXT,
    recipient_address TEXT,
    weight_kg NUMERIC(8, 2) DEFAULT 1.0,
    packages_count INT DEFAULT 1,
    label_url TEXT,
    stock_restored BOOLEAN DEFAULT false,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_provider ON shipments(provider_id);
CREATE INDEX IF NOT EXISTS idx_shipments_manifest ON shipments(manifest_id);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipments_read_all" ON shipments;
CREATE POLICY "shipments_read_all" ON shipments FOR SELECT USING (true);

DROP POLICY IF EXISTS "shipments_write_admin" ON shipments;
CREATE POLICY "shipments_write_admin" ON shipments FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);


-- 7. Create Shipment Tracking Events Table
CREATE TABLE IF NOT EXISTS shipment_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    location TEXT,
    description TEXT,
    actor TEXT DEFAULT 'System',
    event_timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment ON shipment_tracking_events(shipment_id);

ALTER TABLE shipment_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracking_events_read_all" ON shipment_tracking_events;
CREATE POLICY "tracking_events_read_all" ON shipment_tracking_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "tracking_events_write_admin" ON shipment_tracking_events;
CREATE POLICY "tracking_events_write_admin" ON shipment_tracking_events FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);


-- 8. Create COD Settlements & Items Tables
CREATE TABLE IF NOT EXISTS cod_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_number TEXT UNIQUE NOT NULL,
    provider_id UUID REFERENCES shipping_providers(id) ON DELETE RESTRICT,
    treasury_account_id UUID REFERENCES treasury_accounts(id) ON DELETE RESTRICT,
    status TEXT CHECK (status IN ('draft', 'reconciled', 'deposited', 'disputed', 'cancelled')) DEFAULT 'draft',
    total_orders_count INT DEFAULT 0,
    gross_cod_collected NUMERIC(12, 2) DEFAULT 0,
    total_shipping_fees_deducted NUMERIC(12, 2) DEFAULT 0,
    net_payout_amount NUMERIC(12, 2) DEFAULT 0,
    reference_number TEXT,
    finance_payment_id UUID REFERENCES finance_payments(id) ON DELETE SET NULL,
    settled_at TIMESTAMPTZ,
    reconciled_by TEXT DEFAULT 'Admin',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cod_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cod_settlements_read_authenticated" ON cod_settlements;
CREATE POLICY "cod_settlements_read_authenticated" ON cod_settlements FOR SELECT USING (true);

DROP POLICY IF EXISTS "cod_settlements_write_authenticated" ON cod_settlements;
CREATE POLICY "cod_settlements_write_authenticated" ON cod_settlements FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS cod_settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES cod_settlements(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    expected_cod NUMERIC(12, 2) NOT NULL DEFAULT 0,
    collected_cod NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('matched', 'discrepancy', 'rejected')) DEFAULT 'matched',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (settlement_id, shipment_id)
);

ALTER TABLE cod_settlement_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cod_settlement_items_read_authenticated" ON cod_settlement_items;
CREATE POLICY "cod_settlement_items_read_authenticated" ON cod_settlement_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "cod_settlement_items_write_authenticated" ON cod_settlement_items;
CREATE POLICY "cod_settlement_items_write_authenticated" ON cod_settlement_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);


-- 9. Add foreign key columns to orders table if not exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider_id UUID REFERENCES shipping_providers(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_manifest_id UUID REFERENCES shipping_manifests(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_desk_name TEXT;


-- 10. RPC: Process Shipment Status Change (Idempotent & Stock-Safe)
CREATE OR REPLACE FUNCTION process_shipment_status_change(
  p_shipment_id UUID,
  p_new_status TEXT,
  p_location TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_actor TEXT DEFAULT 'System'
)
RETURNS JSONB AS $$
DECLARE
  v_shipment RECORD;
  v_order RECORD;
  v_item RECORD;
  v_main_wh_id UUID;
  v_already_restored BOOLEAN := false;
  v_now TIMESTAMPTZ := now();
  v_mapped_order_status TEXT;
BEGIN
  -- FOR UPDATE lock to prevent race conditions
  SELECT * INTO v_shipment FROM shipments WHERE id = p_shipment_id FOR UPDATE;
  
  IF v_shipment.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shipment not found');
  END IF;

  v_already_restored := COALESCE(v_shipment.stock_restored, false);

  -- Map shipment status to order status
  CASE p_new_status
    WHEN 'shipped', 'in_transit', 'out_for_delivery' THEN
      v_mapped_order_status := 'shipped';
    WHEN 'delivered' THEN
      v_mapped_order_status := 'delivered';
    WHEN 'returned', 'failed_delivery' THEN
      v_mapped_order_status := 'returned';
    WHEN 'cancelled' THEN
      v_mapped_order_status := 'cancelled';
    ELSE
      v_mapped_order_status := v_shipment.status;
  END CASE;

  -- 1. Update Shipment record
  UPDATE shipments
  SET status = p_new_status,
      shipped_at = CASE WHEN p_new_status IN ('shipped', 'in_transit') AND shipped_at IS NULL THEN v_now ELSE shipped_at END,
      delivered_at = CASE WHEN p_new_status = 'delivered' AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
      returned_at = CASE WHEN p_new_status IN ('returned', 'failed_delivery') AND returned_at IS NULL THEN v_now ELSE returned_at END,
      cod_status = CASE WHEN p_new_status = 'delivered' AND cod_status = 'pending' THEN 'collected_by_courier' ELSE cod_status END,
      cod_collected_amount = CASE WHEN p_new_status = 'delivered' THEN cod_amount ELSE cod_collected_amount END,
      updated_at = v_now
  WHERE id = p_shipment_id;

  -- 2. Update Order record
  UPDATE orders
  SET status = v_mapped_order_status,
      tracking_number = COALESCE(v_shipment.tracking_number, tracking_number),
      delivered_at = CASE WHEN p_new_status = 'delivered' AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
      cancelled_at = CASE WHEN p_new_status = 'cancelled' AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END,
      payment_status = CASE WHEN p_new_status = 'delivered' THEN 'paid' ELSE payment_status END,
      updated_at = v_now
  WHERE id = v_shipment.order_id;

  -- 3. Log Tracking Event
  INSERT INTO shipment_tracking_events (
    shipment_id, status, location, description, actor, event_timestamp
  ) VALUES (
    p_shipment_id, p_new_status, COALESCE(p_location, 'Standard Carrier Hub'), 
    COALESCE(p_description, 'Shipment status updated to ' || p_new_status), p_actor, v_now
  );

  -- 4. Idempotent Inventory Restoration on Returned or Cancelled Order
  IF (p_new_status IN ('returned', 'cancelled')) AND NOT v_already_restored THEN
    SELECT id INTO v_main_wh_id FROM warehouses WHERE is_main = true LIMIT 1;
    SELECT * INTO v_order FROM orders WHERE id = v_shipment.order_id;

    IF v_order.items IS NOT NULL AND jsonb_array_length(v_order.items) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_to_recordset(v_order.items) AS x(
        id text, product_id text, variant_id text, quantity int
      ) LOOP
        -- Restore stock via adjust_inventory_level if product_id exists
        IF v_item.product_id IS NOT NULL AND v_item.product_id != '' THEN
          PERFORM adjust_inventory_level(
            v_item.product_id::uuid,
            CASE WHEN v_item.variant_id IS NOT NULL AND v_item.variant_id != '' THEN v_item.variant_id::uuid ELSE NULL END,
            v_main_wh_id,
            v_item.quantity,
            CASE WHEN p_new_status = 'returned' THEN 'order_refund' ELSE 'order_cancellation' END,
            v_order.order_number,
            p_actor,
            'Restored stock for ' || p_new_status || ' shipment ' || COALESCE(v_shipment.tracking_number, '')
          );
        END IF;
      END LOOP;
    END IF;

    -- Mark stock as restored to guarantee EXACTLY ONCE restoration
    UPDATE shipments SET stock_restored = true WHERE id = p_shipment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'shipment_id', p_shipment_id, 
    'new_status', p_new_status, 
    'stock_restored', (p_new_status IN ('returned', 'cancelled') AND NOT v_already_restored)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 11. RPC: Reconcile COD Settlement (Deposit into Treasury & Finance)
CREATE OR REPLACE FUNCTION reconcile_cod_settlement(
  p_settlement_id UUID,
  p_treasury_account_id UUID,
  p_actor TEXT DEFAULT 'Admin'
)
RETURNS JSONB AS $$
DECLARE
  v_settlement RECORD;
  v_item RECORD;
  v_payment_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_settlement FROM cod_settlements WHERE id = p_settlement_id FOR UPDATE;

  IF v_settlement.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Settlement not found');
  END IF;

  IF v_settlement.status = 'deposited' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already deposited', 'settlement_id', p_settlement_id);
  END IF;

  -- 1. Create Finance Payment entry for net payout
  INSERT INTO finance_payments (
    payment_number, customer_name, customer_type, amount,
    payment_method, reference_number, payment_date, status, notes
  ) VALUES (
    'PAY-COD-' || v_settlement.settlement_number,
    'Carrier Settlement - COD',
    'carrier',
    v_settlement.net_payout_amount,
    'bank_transfer',
    v_settlement.settlement_number,
    v_now,
    'completed',
    'Reconciled COD settlement ' || v_settlement.settlement_number
  ) RETURNING id INTO v_payment_id;

  -- 2. Deposit Net Amount into Selected Treasury Account
  UPDATE treasury_accounts
  SET balance = balance + v_settlement.net_payout_amount,
      updated_at = v_now
  WHERE id = p_treasury_account_id;

  -- 3. Update Settlement Record
  UPDATE cod_settlements
  SET status = 'deposited',
      treasury_account_id = p_treasury_account_id,
      finance_payment_id = v_payment_id,
      settled_at = v_now,
      reconciled_by = p_actor,
      updated_at = v_now
  WHERE id = p_settlement_id;

  -- 4. Mark linked shipments COD status as settled
  FOR v_item IN SELECT shipment_id FROM cod_settlement_items WHERE settlement_id = p_settlement_id LOOP
    UPDATE shipments
    SET cod_status = 'settled',
        updated_at = v_now
    WHERE id = v_item.shipment_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', p_settlement_id,
    'net_payout_amount', v_settlement.net_payout_amount,
    'finance_payment_id', v_payment_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 12. RPC: Calculate Order Shipping Fee
CREATE OR REPLACE FUNCTION calculate_order_shipping_fee(
  p_wilaya_id INT,
  p_delivery_type TEXT DEFAULT 'home',
  p_cart_subtotal NUMERIC DEFAULT 0,
  p_provider_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_provider_id UUID := p_provider_id;
  v_rate RECORD;
  v_settings RECORD;
  v_fee NUMERIC(12, 2) := 600;
  v_free_min NUMERIC(12, 2) := 10000;
BEGIN
  -- Get active settings
  SELECT * INTO v_settings FROM shipping_settings WHERE id = 1 LIMIT 1;
  IF v_settings.free_shipping_min_amount IS NOT NULL THEN
    v_free_min := v_settings.free_shipping_min_amount;
  END IF;

  -- If provider not specified, use default provider from settings or first active
  IF v_provider_id IS NULL THEN
    v_provider_id := v_settings.default_provider_id;
  END IF;

  IF v_provider_id IS NULL THEN
    SELECT id INTO v_provider_id FROM shipping_providers WHERE is_active = true ORDER BY is_default DESC LIMIT 1;
  END IF;

  -- Check if subtotal qualifies for free shipping
  IF p_cart_subtotal >= v_free_min THEN
    RETURN jsonb_build_object(
      'shipping_fee', 0,
      'is_free_shipping', true,
      'delivery_type', p_delivery_type,
      'provider_id', v_provider_id
    );
  END IF;

  -- Fetch Rate from shipping_rates for this provider & wilaya
  SELECT * INTO v_rate 
  FROM shipping_rates 
  WHERE provider_id = v_provider_id AND wilaya_id = p_wilaya_id AND is_active = true 
  LIMIT 1;

  IF v_rate.id IS NOT NULL THEN
    IF p_delivery_type = 'stop_desk' THEN
      v_fee := v_rate.desk_fee;
    ELSE
      v_fee := v_rate.home_fee;
    END IF;
  ELSE
    -- Fallback to Wilayas table default fee if rate record missing
    SELECT COALESCE(delivery_fee, 600) INTO v_fee FROM wilayas WHERE id = p_wilaya_id;
    IF p_delivery_type = 'stop_desk' THEN
      v_fee := GREATEST(200, v_fee - 200);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'shipping_fee', v_fee,
    'is_free_shipping', false,
    'delivery_type', p_delivery_type,
    'provider_id', v_provider_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
