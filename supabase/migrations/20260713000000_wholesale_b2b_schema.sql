-- Add MOQ and increment columns to products if they do not exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS moq integer DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS qty_increment integer DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price numeric;

-- Add customer wholesale columns if they do not exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS register_number text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'retail';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS wholesale_status text DEFAULT 'none';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_balance numeric DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_group_id uuid;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms_id uuid;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_tax_exempt boolean DEFAULT false;

-- Create Customer Groups table
CREATE TABLE IF NOT EXISTS customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  name_ar text,
  name_fr text,
  discount_percentage numeric DEFAULT 0,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE customer_groups ADD COLUMN IF NOT EXISTS name_ar text;
ALTER TABLE customer_groups ADD COLUMN IF NOT EXISTS name_fr text;

-- Create Price Lists table
CREATE TABLE IF NOT EXISTS price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Price List Entries table
CREATE TABLE IF NOT EXISTS price_list_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id uuid REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  wholesale_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Customer Price Overrides table
CREATE TABLE IF NOT EXISTS customer_price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  custom_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Payment Terms table
CREATE TABLE IF NOT EXISTS payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  days integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Credit Accounts table
CREATE TABLE IF NOT EXISTS credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  credit_limit numeric DEFAULT 0,
  credit_balance numeric DEFAULT 0,
  available_credit numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Credit Transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_account_id uuid REFERENCES credit_accounts(id) ON DELETE CASCADE,
  order_id uuid,
  type text NOT NULL, -- 'charge', 'payment', 'refund'
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  reference_number text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for new tables
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Setup simple RLS policies allowing authenticated users to read and administrators to modify
CREATE POLICY "Allow public read of customer groups" ON customer_groups FOR SELECT USING (true);
CREATE POLICY "Allow public read of price lists" ON price_lists FOR SELECT USING (true);
CREATE POLICY "Allow public read of price list entries" ON price_list_entries FOR SELECT USING (true);
CREATE POLICY "Allow public read of price overrides" ON customer_price_overrides FOR SELECT USING (true);
CREATE POLICY "Allow public read of payment terms" ON payment_terms FOR SELECT USING (true);
CREATE POLICY "Allow public read of credit accounts" ON credit_accounts FOR SELECT USING (true);
CREATE POLICY "Allow public read of credit transactions" ON credit_transactions FOR SELECT USING (true);

-- Admin write policies
CREATE POLICY "Allow admin to manage customer groups" ON customer_groups FOR ALL USING (true);
CREATE POLICY "Allow admin to manage price lists" ON price_lists FOR ALL USING (true);
CREATE POLICY "Allow admin to manage price list entries" ON price_list_entries FOR ALL USING (true);
CREATE POLICY "Allow admin to manage price overrides" ON customer_price_overrides FOR ALL USING (true);
CREATE POLICY "Allow admin to manage payment terms" ON payment_terms FOR ALL USING (true);
CREATE POLICY "Allow admin to manage credit accounts" ON credit_accounts FOR ALL USING (true);
CREATE POLICY "Allow admin to manage credit transactions" ON credit_transactions FOR ALL USING (true);

-- Insert Default Payment Terms
INSERT INTO payment_terms (name, days, is_active) VALUES
  ('Cash on Delivery', 0, true),
  ('Net 15 Days', 15, true),
  ('Net 30 Days', 30, true),
  ('Net 60 Days', 60, true)
ON CONFLICT DO NOTHING;

-- Insert Default Customer Groups
INSERT INTO customer_groups (name, discount_percentage, description) VALUES
  ('Retail Clients', 0, 'Standard retail customers'),
  ('Silver Wholesale Partners', 5, 'B2B partners with small MOQ'),
  ('Gold Wholesale Partners', 10, 'B2B partners with medium MOQ and credit lines'),
  ('VIP Distributors', 15, 'High volume premium distributors')
ON CONFLICT DO NOTHING;

-- Create Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL,
  payment_terms_id uuid REFERENCES payment_terms(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Wholesale Invoices table
CREATE TABLE IF NOT EXISTS wholesale_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  order_id uuid,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL,
  due_date timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'unpaid',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_invoices ENABLE ROW LEVEL SECURITY;

-- Setup RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'Allow public read of purchase orders') THEN
    CREATE POLICY "Allow public read of purchase orders" ON purchase_orders FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'Allow public insert of purchase orders') THEN
    CREATE POLICY "Allow public insert of purchase orders" ON purchase_orders FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'Allow admin to manage purchase orders') THEN
    CREATE POLICY "Allow admin to manage purchase orders" ON purchase_orders FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wholesale_invoices' AND policyname = 'Allow public read of wholesale invoices') THEN
    CREATE POLICY "Allow public read of wholesale invoices" ON wholesale_invoices FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wholesale_invoices' AND policyname = 'Allow public insert of wholesale invoices') THEN
    CREATE POLICY "Allow public insert of wholesale invoices" ON wholesale_invoices FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wholesale_invoices' AND policyname = 'Allow admin to manage wholesale invoices') THEN
    CREATE POLICY "Allow admin to manage wholesale invoices" ON wholesale_invoices FOR ALL USING (true);
  END IF;
END
$$;
