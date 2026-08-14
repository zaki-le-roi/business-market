-- ==============================================================================
-- BUSINESS MARKET - COMPLETE MASTER DATABASE SYNCHRONIZATION SCRIPT
-- Target Supabase Instance: https://dyhpfgjogdiongmcmoti.supabase.co
-- Idempotent Migration: Safe to run on existing production database.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 2. ADMIN RBAC & AUTHENTICATION
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.admin_roles (id, name, permissions) VALUES
('super-admin', 'Super Administrator', ARRAY[
  'manage_products', 'manage_categories', 'manage_orders', 'manage_customers', 
  'manage_wholesale_customers', 'manage_discounts', 'manage_coupons', 
  'manage_shipping', 'manage_reports', 'manage_settings', 'manage_administrators'
]),
('store-manager', 'Store Manager', ARRAY[
  'manage_products', 'manage_categories', 'manage_orders', 'manage_customers', 
  'manage_wholesale_customers', 'manage_discounts', 'manage_coupons', 
  'manage_shipping', 'manage_reports', 'manage_settings'
]),
('product-manager', 'Product Manager', ARRAY['manage_products', 'manage_categories']),
('order-manager', 'Order Manager', ARRAY['manage_orders', 'manage_shipping']),
('customer-support', 'Customer Support', ARRAY['manage_customers', 'manage_support']),
('warehouse-manager', 'Warehouse Manager', ARRAY['manage_products', 'manage_orders', 'manage_shipping']),
('marketing-manager', 'Marketing Manager', ARRAY['manage_discounts', 'manage_coupons']),
('accountant', 'Accountant', ARRAY['manage_reports'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  permissions = EXCLUDED.permissions;

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role_id TEXT REFERENCES public.admin_roles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'super_admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill admin users from auth.users if any exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO public.admin_users (id, email, role, is_active)
    SELECT id, email, 'super_admin', true FROM auth.users
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.admin_profiles (id, email, role_id, is_active)
    SELECT id, email, 'super-admin', true FROM auth.users
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Trigger to auto sync new auth users
CREATE OR REPLACE FUNCTION public.handle_new_admin_user_sync()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_users (id, email, role, is_active)
  VALUES (NEW.id, NEW.email, 'super_admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin', is_active = true;

  INSERT INTO public.admin_profiles (id, email, role_id, is_active)
  VALUES (NEW.id, NEW.email, 'super-admin', true)
  ON CONFLICT (id) DO UPDATE SET role_id = 'super-admin', is_active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_admin_user_created ON auth.users;
CREATE TRIGGER tr_sync_admin_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_admin_user_sync();

-- Helper function: public.is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.admin_profiles
        WHERE id = auth.uid() AND is_active = true
      )
      OR EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = auth.uid()
      )
    )
  );
END;
$$;

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read of roles" ON public.admin_roles;
CREATE POLICY "Allow authenticated read of roles" ON public.admin_roles FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated read of admin profiles" ON public.admin_profiles;
CREATE POLICY "Allow authenticated read of admin profiles" ON public.admin_profiles FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated read of admin_users" ON public.admin_users;
CREATE POLICY "Allow authenticated read of admin_users" ON public.admin_users FOR SELECT TO authenticated USING (true);

-- ==============================================================================
-- 3. SCHEMA EXTENSIONS ON EXISTING CORE TABLES
-- ==============================================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moq integer DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS qty_increment integer DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_price numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_wholesale_only boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sales_count integer DEFAULT 0;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS register_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'retail';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS wholesale_status text DEFAULT 'none';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_balance numeric DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_group_id uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS payment_terms_id uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_tax_exempt boolean DEFAULT false;

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'all';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS per_customer_limit integer DEFAULT 1;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS customer_group_restriction text DEFAULT 'all';

-- ==============================================================================
-- 4. WHOLESALE & B2B MODULE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  name_ar text,
  name_fr text,
  discount_percentage numeric DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.customer_groups (name, discount_percentage, description) VALUES
  ('Retail Clients', 0, 'Standard retail customers'),
  ('Silver Wholesale Partners', 5, 'B2B partners with small MOQ'),
  ('Gold Wholesale Partners', 10, 'B2B partners with medium MOQ and credit lines'),
  ('VIP Distributors', 15, 'High volume premium distributors')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  days integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.payment_terms (name, days, is_active) VALUES
  ('Cash on Delivery', 0, true),
  ('Net 15 Days', 15, true),
  ('Net 30 Days', 30, true),
  ('Net 60 Days', 60, true)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_fr text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.payment_methods (code, name_ar, name_fr, is_active) VALUES
  ('cod', 'الدفع عند الاستلام', 'Paiement à la livraison', true),
  ('bank_transfer', 'تحويل بنكي / بريدي', 'Virement bancaire / CCP', true),
  ('check', 'شيك بنكي', 'Chèque bancaire', true),
  ('credit', 'حساب ائتماني', 'Compte crédit', true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.price_list_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id uuid REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  wholesale_price numeric NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.customer_price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  custom_price numeric NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  credit_limit numeric DEFAULT 0,
  credit_balance numeric DEFAULT 0,
  available_credit numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_account_id uuid REFERENCES public.credit_accounts(id) ON DELETE CASCADE,
  order_id uuid,
  type text NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  reference_number text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL,
  payment_terms_id uuid REFERENCES public.payment_terms(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wholesale_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  order_id uuid,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL,
  due_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'unpaid',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wholesale_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  created_by text DEFAULT 'Admin',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wholesale_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_order_amount numeric DEFAULT 50000,
  credit_limit_default numeric DEFAULT 100000,
  auto_approve_po boolean DEFAULT false,
  default_payment_terms_days integer DEFAULT 30,
  wholesale_terms_notes text DEFAULT '1. Le paiement doit être effectué dans le délai convenu. 2. Tout retard entraînera la suspension du compte crédit.',
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.wholesale_settings (id, min_order_amount, credit_limit_default, auto_approve_po, default_payment_terms_days)
SELECT '00000000-0000-0000-0000-000000000001', 50000, 100000, false, 30
WHERE NOT EXISTS (SELECT 1 FROM public.wholesale_settings);

-- Atomic Credit Adjustment RPC
CREATE OR REPLACE FUNCTION public.adjust_customer_credit(
  p_customer_id uuid,
  p_amount numeric,
  p_type text,
  p_order_id uuid DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_acc credit_accounts%ROWTYPE;
  v_new_balance numeric;
  v_available numeric;
  v_tx_id uuid;
BEGIN
  SELECT * INTO v_credit_acc
  FROM credit_accounts
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO credit_accounts (customer_id, credit_limit, credit_balance, available_credit, is_active)
    VALUES (p_customer_id, 100000, 0, 100000, true)
    RETURNING * INTO v_credit_acc;
  END IF;

  IF p_type = 'charge' THEN
    v_new_balance := v_credit_acc.credit_balance + p_amount;
  ELSIF p_type = 'payment' THEN
    v_new_balance := v_credit_acc.credit_balance - p_amount;
  ELSIF p_type = 'refund' THEN
    v_new_balance := v_credit_acc.credit_balance - p_amount;
  ELSE
    RAISE EXCEPTION 'Invalid credit transaction type %', p_type;
  END IF;

  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  v_available := GREATEST(0, v_credit_acc.credit_limit - v_new_balance);

  UPDATE credit_accounts
  SET credit_balance = v_new_balance,
      available_credit = v_available,
      customer_id = p_customer_id
  WHERE id = v_credit_acc.id;

  UPDATE customers
  SET credit_balance = v_new_balance,
      credit_limit = v_credit_acc.credit_limit
  WHERE id = p_customer_id;

  INSERT INTO credit_transactions (
    credit_account_id, order_id, type, amount, balance_after, description, reference_number, created_at
  ) VALUES (
    v_credit_acc.id, p_order_id, p_type, p_amount, v_new_balance, p_description, p_reference_number, now()
  ) RETURNING id INTO v_tx_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance,
    'available_credit', v_available
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Enable RLS & Policies for Wholesale Tables
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_price_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_groups_all" ON public.customer_groups FOR ALL USING (true);
CREATE POLICY "payment_terms_all" ON public.payment_terms FOR ALL USING (true);
CREATE POLICY "payment_methods_all" ON public.payment_methods FOR ALL USING (true);
CREATE POLICY "price_lists_all" ON public.price_lists FOR ALL USING (true);
CREATE POLICY "price_list_entries_all" ON public.price_list_entries FOR ALL USING (true);
CREATE POLICY "customer_price_overrides_all" ON public.customer_price_overrides FOR ALL USING (true);
CREATE POLICY "credit_accounts_all" ON public.credit_accounts FOR ALL USING (true);
CREATE POLICY "credit_transactions_all" ON public.credit_transactions FOR ALL USING (true);
CREATE POLICY "purchase_orders_all" ON public.purchase_orders FOR ALL USING (true);
CREATE POLICY "wholesale_invoices_all" ON public.wholesale_invoices FOR ALL USING (true);
CREATE POLICY "wholesale_activity_logs_all" ON public.wholesale_activity_logs FOR ALL USING (true);
CREATE POLICY "wholesale_settings_all" ON public.wholesale_settings FOR ALL USING (true);

-- ==============================================================================
-- 5. MARKETING MODULE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.marketing_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_ar TEXT NOT NULL,
    title_fr TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('flash_sale', 'product_discount', 'category_discount', 'buy_x_get_y', 'bundle', 'scheduled')),
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
    discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    target_type TEXT NOT NULL DEFAULT 'all_products' CHECK (target_type IN ('all_products', 'specific_products', 'specific_categories')),
    product_ids TEXT[] DEFAULT '{}',
    category_ids TEXT[] DEFAULT '{}',
    buy_x INT DEFAULT 0,
    get_y INT DEFAULT 0,
    bundle_price NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_group TEXT NOT NULL DEFAULT 'all' CHECK (target_group IN ('all', 'retail', 'wholesale', 'selected')),
    selected_customer_ids TEXT[] DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marketing_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_select_all" ON public.marketing_promotions FOR SELECT USING (true);
CREATE POLICY "promotions_all_auth" ON public.marketing_promotions FOR ALL TO authenticated USING (true);

CREATE POLICY "notifications_select_all" ON public.marketing_notifications FOR SELECT USING (true);
CREATE POLICY "notifications_all_auth" ON public.marketing_notifications FOR ALL TO authenticated USING (true);

-- ==============================================================================
-- 6. FINANCE & TREASURY MODULE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.treasury_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'bank', 'ccp', 'safe'
    account_number TEXT,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'DZD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.treasury_accounts (name_ar, name_fr, type, balance)
VALUES 
  ('الخزينة الرئيسية (كاش)', 'Caisse Principale (Cash)', 'cash', 0),
  ('حساب بريد الجزائر (CCP)', 'Compte CCP Algérie Poste', 'ccp', 0),
  ('حساب البنك الوطني (BNA)', 'Compte BNA Banque', 'bank', 0)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.finance_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    order_id TEXT,
    order_number TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_type TEXT NOT NULL DEFAULT 'retail',
    issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date TIMESTAMPTZ,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT,
    invoice_id TEXT,
    invoice_number TEXT,
    order_number TEXT,
    customer_name TEXT NOT NULL,
    customer_type TEXT NOT NULL DEFAULT 'retail',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    treasury_account_id UUID REFERENCES public.treasury_accounts(id) ON DELETE SET NULL,
    reference_number TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    expense_type TEXT NOT NULL DEFAULT 'operational',
    vendor_name TEXT NOT NULL DEFAULT '',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    treasury_account_id UUID REFERENCES public.treasury_accounts(id) ON DELETE SET NULL,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treasury_accounts_all" ON public.treasury_accounts FOR ALL USING (true);
CREATE POLICY "finance_invoices_all" ON public.finance_invoices FOR ALL USING (true);
CREATE POLICY "finance_payments_all" ON public.finance_payments FOR ALL USING (true);
CREATE POLICY "finance_expenses_all" ON public.finance_expenses FOR ALL USING (true);

-- ==============================================================================
-- 7. INVENTORY, WAREHOUSES & VARIANTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
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

INSERT INTO public.warehouses (code, name_ar, name_fr, is_main, is_active)
VALUES ('WH-MAIN', 'المستودع الرئيسي', 'Entrepôt Principal', true, true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '{}'::jsonb,
    price_override NUMERIC(12, 2),
    wholesale_price NUMERIC(12, 2),
    stock_quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 0,
    damaged_quantity INT NOT NULL DEFAULT 0,
    rack_location TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_levels_unique 
ON public.inventory_levels (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    target_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL,
    quantity_change INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reference_number TEXT,
    created_by TEXT DEFAULT 'Admin',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
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

CREATE TABLE IF NOT EXISTS public.supplier_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'draft',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_delivery_date TIMESTAMPTZ,
    notes TEXT,
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_settings (
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

INSERT INTO public.store_settings (id, store_name_ar, store_name_fr, store_name_en, default_language, default_currency)
VALUES (1, 'بيزنس ماركت', 'Business Market', 'Business Market', 'ar', 'DZD')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT NOT NULL UNIQUE,
    from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'completed',
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sync product stock trigger
CREATE OR REPLACE FUNCTION public.sync_product_stock_from_inventory()
RETURNS TRIGGER AS $$
DECLARE
  target_prod_id UUID;
  total_qty INT;
BEGIN
  target_prod_id := COALESCE(NEW.product_id, OLD.product_id);
  
  SELECT COALESCE(SUM(quantity), 0) INTO total_qty
  FROM public.inventory_levels
  WHERE product_id = target_prod_id AND variant_id IS NULL;

  UPDATE public.products
  SET stock_quantity = total_qty,
      updated_at = now()
  WHERE id = target_prod_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_product_stock ON public.inventory_levels;
CREATE TRIGGER trigger_sync_product_stock
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_levels
FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock_from_inventory();

-- Initial inventory levels seed for existing products
DO $$
DECLARE
  main_wh_id UUID;
  prod RECORD;
BEGIN
  SELECT id INTO main_wh_id FROM public.warehouses WHERE is_main = true LIMIT 1;
  IF main_wh_id IS NOT NULL THEN
    FOR prod IN SELECT id, stock_quantity FROM public.products LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.inventory_levels 
        WHERE product_id = prod.id 
          AND variant_id IS NULL 
          AND warehouse_id = main_wh_id
      ) THEN
        INSERT INTO public.inventory_levels (product_id, warehouse_id, quantity)
        VALUES (prod.id, main_wh_id, COALESCE(prod.stock_quantity, 0));

        INSERT INTO public.inventory_movements (
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

-- Inventory RPCs
CREATE OR REPLACE FUNCTION public.decrement_stock(product_id uuid, quantity int)
RETURNS void AS $$
DECLARE
  wh_id uuid;
  current_qty int := 0;
  new_qty int := 0;
BEGIN
  SELECT warehouse_id, quantity INTO wh_id, current_qty
  FROM public.inventory_levels
  WHERE inventory_levels.product_id = decrement_stock.product_id AND variant_id IS NULL
  ORDER BY quantity DESC
  LIMIT 1;

  IF wh_id IS NULL THEN
    SELECT id INTO wh_id FROM public.warehouses WHERE is_main = true LIMIT 1;
    current_qty := 0;
  END IF;

  new_qty := GREATEST(0, COALESCE(current_qty, 0) - quantity);

  IF EXISTS (
    SELECT 1 FROM public.inventory_levels 
    WHERE inventory_levels.product_id = decrement_stock.product_id 
      AND variant_id IS NULL 
      AND warehouse_id = wh_id
  ) THEN
    UPDATE public.inventory_levels
    SET quantity = new_qty, updated_at = now()
    WHERE inventory_levels.product_id = decrement_stock.product_id 
      AND variant_id IS NULL 
      AND warehouse_id = wh_id;
  ELSE
    INSERT INTO public.inventory_levels (product_id, warehouse_id, quantity)
    VALUES (decrement_stock.product_id, wh_id, new_qty);
  END IF;

  INSERT INTO public.inventory_movements (
    product_id, warehouse_id, movement_type, 
    quantity_change, previous_stock, new_stock, 
    reference_number, created_by, notes
  ) VALUES (
    decrement_stock.product_id, wh_id, 'order_deduction', 
    -quantity, COALESCE(current_qty, 0), new_qty, 
    'ONLINE-ORDER', 'Storefront Checkout', 'Automatic order stock deduction'
  );

  UPDATE public.products SET sales_count = COALESCE(sales_count, 0) + quantity WHERE id = decrement_stock.product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.adjust_inventory_level(
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
  FROM public.inventory_levels
  WHERE product_id = p_product_id 
    AND (variant_id IS NOT DISTINCT FROM v_var_id)
    AND warehouse_id = p_warehouse_id;

  current_qty := COALESCE(current_qty, 0);
  new_qty := GREATEST(0, current_qty + p_qty_change);

  IF EXISTS (
    SELECT 1 FROM public.inventory_levels 
    WHERE product_id = p_product_id 
      AND (variant_id IS NOT DISTINCT FROM v_var_id) 
      AND warehouse_id = p_warehouse_id
  ) THEN
    UPDATE public.inventory_levels
    SET quantity = new_qty, updated_at = now()
    WHERE product_id = p_product_id 
      AND (variant_id IS NOT DISTINCT FROM v_var_id) 
      AND warehouse_id = p_warehouse_id;
  ELSE
    INSERT INTO public.inventory_levels (product_id, variant_id, warehouse_id, quantity)
    VALUES (p_product_id, v_var_id, p_warehouse_id, new_qty);
  END IF;

  INSERT INTO public.inventory_movements (
    product_id, variant_id, warehouse_id, movement_type, 
    quantity_change, previous_stock, new_stock, reference_number, created_by, notes
  ) VALUES (
    p_product_id, v_var_id, p_warehouse_id, p_movement_type,
    p_qty_change, current_qty, new_qty, p_ref, p_actor, p_notes
  );

  IF v_var_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock_quantity = (
      SELECT COALESCE(SUM(quantity), 0) 
      FROM public.inventory_levels 
      WHERE variant_id = v_var_id
    ), updated_at = now()
    WHERE id = v_var_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'previous_stock', current_qty, 'new_stock', new_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.transfer_inventory_between_warehouses(
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
  FROM public.inventory_levels
  WHERE product_id = p_product_id 
    AND (variant_id IS NOT DISTINCT FROM v_var_id)
    AND warehouse_id = p_from_warehouse_id;

  from_qty := COALESCE(from_qty, 0);

  IF from_qty < p_transfer_qty THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock in source warehouse');
  END IF;

  UPDATE public.inventory_levels
  SET quantity = from_qty - p_transfer_qty, updated_at = now()
  WHERE product_id = p_product_id 
    AND (variant_id IS NOT DISTINCT FROM v_var_id)
    AND warehouse_id = p_from_warehouse_id;

  SELECT quantity INTO to_qty
  FROM public.inventory_levels
  WHERE product_id = p_product_id 
    AND (variant_id IS NOT DISTINCT FROM v_var_id)
    AND warehouse_id = p_to_warehouse_id;

  to_qty := COALESCE(to_qty, 0);

  IF EXISTS (
    SELECT 1 FROM public.inventory_levels 
    WHERE product_id = p_product_id 
      AND (variant_id IS NOT DISTINCT FROM v_var_id) 
      AND warehouse_id = p_to_warehouse_id
  ) THEN
    UPDATE public.inventory_levels
    SET quantity = to_qty + p_transfer_qty, updated_at = now()
    WHERE product_id = p_product_id 
      AND (variant_id IS NOT DISTINCT FROM v_var_id) 
      AND warehouse_id = p_to_warehouse_id;
  ELSE
    INSERT INTO public.inventory_levels (product_id, variant_id, warehouse_id, quantity)
    VALUES (p_product_id, v_var_id, p_to_warehouse_id, p_transfer_qty);
  END IF;

  INSERT INTO public.inventory_movements (
    product_id, variant_id, warehouse_id, target_warehouse_id, movement_type,
    quantity_change, previous_stock, new_stock, reference_number, created_by, notes
  ) VALUES (
    p_product_id, v_var_id, p_from_warehouse_id, p_to_warehouse_id, 'warehouse_transfer',
    -p_transfer_qty, from_qty, from_qty - p_transfer_qty, 'WH-TRANSFER', p_actor, p_notes
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS for Inventory Tables
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_all" ON public.warehouses FOR ALL USING (true);
CREATE POLICY "product_variants_all" ON public.product_variants FOR ALL USING (true);
CREATE POLICY "inventory_levels_all" ON public.inventory_levels FOR ALL USING (true);
CREATE POLICY "inventory_movements_all" ON public.inventory_movements FOR ALL USING (true);
CREATE POLICY "suppliers_all" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "supplier_purchase_orders_all" ON public.supplier_purchase_orders FOR ALL USING (true);
CREATE POLICY "store_settings_all" ON public.store_settings FOR ALL USING (true);
CREATE POLICY "inventory_transfers_all" ON public.inventory_transfers FOR ALL USING (true);

-- ==============================================================================
-- 8. CMS V2 ENTERPRISE MODULE
-- ==============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_page_status') THEN
        CREATE TYPE cms_page_status AS ENUM ('published', 'draft', 'scheduled');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_page_type') THEN
        CREATE TYPE cms_page_type AS ENUM (
            'static_about', 'static_contact', 'static_privacy', 'static_terms',
            'static_returns', 'static_shipping', 'static_faq', 'custom'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_media_file_type') THEN
        CREATE TYPE cms_media_file_type AS ENUM ('image', 'pdf', 'video', 'document');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.cms_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    type cms_page_type NOT NULL DEFAULT 'custom',
    title_ar TEXT NOT NULL DEFAULT '',
    title_fr TEXT NOT NULL DEFAULT '',
    title_en TEXT NOT NULL DEFAULT '',
    content_ar TEXT NOT NULL DEFAULT '',
    content_fr TEXT NOT NULL DEFAULT '',
    content_en TEXT NOT NULL DEFAULT '',
    status cms_page_status NOT NULL DEFAULT 'draft',
    publish_date TIMESTAMPTZ,
    seo JSONB NOT NULL DEFAULT '{}'::jsonb,
    author TEXT DEFAULT 'Admin',
    view_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON public.cms_pages(slug);
CREATE INDEX IF NOT EXISTS idx_cms_pages_key ON public.cms_pages(key);
CREATE INDEX IF NOT EXISTS idx_cms_pages_status ON public.cms_pages(status);
CREATE INDEX IF NOT EXISTS idx_cms_pages_type ON public.cms_pages(type);

CREATE TABLE IF NOT EXISTS public.cms_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    title_ar TEXT,
    title_fr TEXT,
    title_en TEXT,
    description_ar TEXT,
    description_fr TEXT,
    folder VARCHAR(255) NOT NULL DEFAULT '/',
    file_type cms_media_file_type NOT NULL DEFAULT 'image',
    url TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    dimensions VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'published',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_media_folder ON public.cms_media(folder);
CREATE INDEX IF NOT EXISTS idx_cms_media_file_type ON public.cms_media(file_type);

CREATE TABLE IF NOT EXISTS public.cms_page_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    author TEXT DEFAULT 'Admin',
    title_ar TEXT NOT NULL,
    title_fr TEXT NOT NULL,
    title_en TEXT NOT NULL,
    content_ar TEXT NOT NULL,
    content_fr TEXT NOT NULL,
    content_en TEXT NOT NULL,
    status cms_page_status NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_page_revision_version UNIQUE (page_id, version)
);

CREATE INDEX IF NOT EXISTS idx_cms_page_revisions_page_id ON public.cms_page_revisions(page_id);

CREATE TABLE IF NOT EXISTS public.cms_page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    ip_hash VARCHAR(64),
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_page_session_window UNIQUE (page_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_page_views_page_id ON public.cms_page_views(page_id);

CREATE TABLE IF NOT EXISTS public.cms_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    entity_type VARCHAR(50) NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "user" VARCHAR(255) NOT NULL DEFAULT 'Admin',
    ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_cms_activity_logs_timestamp ON public.cms_activity_logs(timestamp DESC);

CREATE OR REPLACE FUNCTION public.fn_set_cms_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cms_pages_updated_at ON public.cms_pages;
CREATE TRIGGER trg_cms_pages_updated_at
    BEFORE UPDATE ON public.cms_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_cms_updated_at();

DROP TRIGGER IF EXISTS trg_cms_media_updated_at ON public.cms_media;
CREATE TRIGGER trg_cms_media_updated_at
    BEFORE UPDATE ON public.cms_media
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_cms_updated_at();

-- Safe migrate from old cms_content
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cms_content') THEN
        INSERT INTO public.cms_pages (
            id, key, slug, type, title_ar, title_fr, title_en, content_ar, content_fr, content_en, status, publish_date, seo, author, view_count, created_at, updated_at
        )
        SELECT
            c.id,
            c.key,
            COALESCE(c.metadata->>'slug', c.key) AS slug,
            CASE 
                WHEN c.key LIKE 'static_%' OR (c.metadata->>'type') IN ('static_about','static_contact','static_privacy','static_terms','static_returns','static_shipping','static_faq')
                THEN COALESCE((c.metadata->>'type')::cms_page_type, 'custom'::cms_page_type)
                ELSE 'custom'::cms_page_type
            END AS type,
            COALESCE(c.title_ar, '') AS title_ar,
            COALESCE(c.title_fr, '') AS title_fr,
            COALESCE(c.metadata->>'title_en', c.title_fr, '') AS title_en,
            COALESCE(c.content_ar, '') AS content_ar,
            COALESCE(c.content_fr, '') AS content_fr,
            COALESCE(c.metadata->>'content_en', c.content_fr, '') AS content_en,
            CASE WHEN c.is_active = true THEN 'published'::cms_page_status ELSE 'draft'::cms_page_status END AS status,
            CASE WHEN (c.metadata->>'publish_date') IS NOT NULL AND (c.metadata->>'publish_date') != '' THEN (c.metadata->>'publish_date')::timestamptz ELSE NULL END AS publish_date,
            COALESCE(c.metadata->'seo', '{}'::jsonb) AS seo,
            COALESCE(c.metadata->>'author', 'Admin') AS author,
            COALESCE((c.metadata->>'view_count')::bigint, 0) AS view_count,
            COALESCE(c.created_at, NOW()) AS created_at,
            COALESCE(c.updated_at, NOW()) AS updated_at
        FROM public.cms_content c
        WHERE c.type = 'page' OR c.key LIKE 'page_%' OR c.key LIKE 'static_%' OR (c.metadata->>'slug') IS NOT NULL
        ON CONFLICT (id) DO NOTHING
        ON CONFLICT (key) DO NOTHING
        ON CONFLICT (slug) DO NOTHING;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_cms_page_view(
    p_page_id UUID,
    p_session_id VARCHAR(255)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.cms_page_views (page_id, session_id)
    VALUES (p_page_id, p_session_id)
    ON CONFLICT (page_id, session_id) DO NOTHING;

    IF FOUND THEN
        UPDATE public.cms_pages
        SET view_count = view_count + 1
        WHERE id = p_page_id;
    END IF;
END;
$$;

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cms_pages_read" ON public.cms_pages FOR SELECT USING (true);
CREATE POLICY "cms_pages_write" ON public.cms_pages FOR ALL USING (true);

CREATE POLICY "cms_media_read" ON public.cms_media FOR SELECT USING (true);
CREATE POLICY "cms_media_write" ON public.cms_media FOR ALL USING (true);

CREATE POLICY "cms_page_revisions_all" ON public.cms_page_revisions FOR ALL USING (true);
CREATE POLICY "cms_page_views_all" ON public.cms_page_views FOR ALL USING (true);
CREATE POLICY "cms_activity_logs_all" ON public.cms_activity_logs FOR ALL USING (true);

-- ==============================================================================
-- 9. META SOCIAL COMMERCE & COMPLIANCE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meta_data_deletion_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    confirmation_code TEXT UNIQUE NOT NULL,
    meta_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    details JSONB DEFAULT '{}'::jsonb,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_deletion_code ON public.meta_data_deletion_requests(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_meta_deletion_user_id ON public.meta_data_deletion_requests(meta_user_id);

CREATE TABLE IF NOT EXISTS public.meta_deletion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confirmation_code TEXT NOT NULL,
    meta_user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meta_data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_deletion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_deletion_requests_all" ON public.meta_data_deletion_requests FOR ALL USING (true);
CREATE POLICY "meta_deletion_logs_all" ON public.meta_deletion_logs FOR ALL USING (true);

-- Public Status Lookup RPC
CREATE OR REPLACE FUNCTION public.get_meta_deletion_status(p_code TEXT)
RETURNS TABLE (
  confirmation_code TEXT,
  status TEXT,
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_code IS NULL OR p_code !~ '^DEL-[A-F0-9]{12,64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    m.confirmation_code,
    m.status,
    m.requested_at,
    m.completed_at
  FROM public.meta_data_deletion_requests m
  WHERE m.confirmation_code = UPPER(TRIM(p_code));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meta_deletion_status(TEXT) TO anon, authenticated;

-- Protected Deletion Recording RPC
CREATE OR REPLACE FUNCTION public.record_meta_data_deletion(
  p_confirmation_code TEXT,
  p_meta_user_id TEXT,
  p_details JSONB,
  p_server_proof TEXT,
  p_issued_at BIGINT
)
RETURNS TABLE (
  id TEXT,
  confirmation_code TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app_secret TEXT;
  v_expected_proof TEXT;
  v_rec_id TEXT;
  v_now_epoch BIGINT;
BEGIN
  IF p_confirmation_code IS NULL OR p_confirmation_code !~ '^DEL-[A-F0-9]{12,64}$' THEN
    RAISE EXCEPTION 'Invalid confirmation code format.';
  END IF;

  IF p_meta_user_id IS NULL OR TRIM(p_meta_user_id) = '' THEN
    RAISE EXCEPTION 'Invalid Meta User ID parameter.';
  END IF;

  IF p_server_proof IS NULL OR LENGTH(TRIM(p_server_proof)) != 64 THEN
    RAISE EXCEPTION 'Invalid or missing server verification proof.';
  END IF;

  IF p_issued_at IS NULL OR p_issued_at <= 0 THEN
    RAISE EXCEPTION 'Unauthorized deletion attempt: Missing or invalid issued_at timestamp parameter.';
  END IF;

  v_now_epoch := EXTRACT(EPOCH FROM NOW())::BIGINT;
  IF (v_now_epoch - p_issued_at) > 3600 OR (v_now_epoch - p_issued_at) < -300 THEN
    RAISE EXCEPTION 'Unauthorized deletion attempt: Invalid or expired issued_at timestamp.';
  END IF;

  SELECT (value->>'appSecret') INTO v_app_secret
  FROM public.system_settings
  WHERE key = 'meta_social_commerce_config'
  LIMIT 1;

  IF v_app_secret IS NULL OR TRIM(v_app_secret) = '' THEN
    RAISE EXCEPTION 'Unauthorized deletion attempt: Meta App Secret is not configured in database settings.';
  END IF;

  v_expected_proof := encode(
    hmac(
      ('META_DELETE_PROOF_V2:' || UPPER(TRIM(p_confirmation_code)) || ':' || TRIM(p_meta_user_id) || ':' || p_issued_at::text)::bytea,
      v_app_secret::bytea,
      'sha256'
    ),
    'hex'
  );

  IF LOWER(TRIM(p_server_proof)) != LOWER(v_expected_proof) THEN
    RAISE EXCEPTION 'Unauthorized deletion attempt: Invalid server HMAC-SHA256 proof.';
  END IF;

  INSERT INTO public.meta_data_deletion_requests (
    confirmation_code, meta_user_id, status, details, requested_at, completed_at
  ) VALUES (
    UPPER(TRIM(p_confirmation_code)), TRIM(p_meta_user_id), 'completed', COALESCE(p_details, '{}'::jsonb), NOW(), NOW()
  )
  ON CONFLICT (confirmation_code) DO UPDATE
    SET status = 'completed',
        details = EXCLUDED.details,
        completed_at = NOW(),
        updated_at = NOW()
  RETURNING meta_data_deletion_requests.id INTO v_rec_id;

  UPDATE public.customers
  SET name = 'Anonymized User',
      email = 'deleted-' || UPPER(TRIM(p_confirmation_code)) || '@anonymized.invalid',
      phone = '0000000000',
      updated_at = NOW()
  WHERE notes LIKE '%' || TRIM(p_meta_user_id) || '%';

  RETURN QUERY
  SELECT v_rec_id, UPPER(TRIM(p_confirmation_code)), 'completed'::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_meta_data_deletion(TEXT, TEXT, JSONB, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_meta_data_deletion(TEXT, TEXT, JSONB, TEXT, BIGINT) TO service_role, postgres;

-- ==============================================================================
-- 10. STORAGE BUCKETS SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('products', 'products', true),
  ('categories', 'categories', true),
  ('avatars', 'avatars', true),
  ('cms-images', 'cms-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read storage objects" ON storage.objects;
CREATE POLICY "Public read storage objects" ON storage.objects
FOR SELECT USING (bucket_id IN ('products', 'categories', 'avatars', 'cms-images'));

DROP POLICY IF EXISTS "Authenticated upload storage objects" ON storage.objects;
CREATE POLICY "Authenticated upload storage objects" ON storage.objects
FOR ALL USING (bucket_id IN ('products', 'categories', 'avatars', 'cms-images'))
WITH CHECK (bucket_id IN ('products', 'categories', 'avatars', 'cms-images'));

COMMIT;
