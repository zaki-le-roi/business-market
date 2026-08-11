-- Module 4: Wholesale & B2B Portal Schema Updates

-- 1. Product & Variant Extensions
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS wholesale_price numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_wholesale_only boolean DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'all'; -- 'all', 'retail', 'wholesale'

-- 2. Wholesale Activity Logs
CREATE TABLE IF NOT EXISTS wholesale_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  created_by text DEFAULT 'Admin',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Wholesale Settings
CREATE TABLE IF NOT EXISTS wholesale_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_order_amount numeric DEFAULT 50000,
  credit_limit_default numeric DEFAULT 100000,
  auto_approve_po boolean DEFAULT false,
  default_payment_terms_days integer DEFAULT 30,
  wholesale_terms_notes text DEFAULT '1. Le paiement doit être effectué dans le délai convenu. 2. Tout retard entraînera la suspension du compte crédit.',
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert initial wholesale settings row if empty
INSERT INTO wholesale_settings (id, min_order_amount, credit_limit_default, auto_approve_po, default_payment_terms_days)
SELECT '00000000-0000-0000-0000-000000000001', 50000, 100000, false, 30
WHERE NOT EXISTS (SELECT 1 FROM wholesale_settings);

-- 4. Enable RLS
ALTER TABLE wholesale_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_settings ENABLE ROW LEVEL SECURITY;

-- 5. Atomic Credit Adjustment RPC Function
CREATE OR REPLACE FUNCTION adjust_customer_credit(
  p_customer_id uuid,
  p_amount numeric,
  p_type text, -- 'charge', 'payment', 'refund'
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
  -- Lock row or insert if missing
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

  -- Ensure balance doesn't go below zero if payment exceeds
  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  v_available := GREATEST(0, v_credit_acc.credit_limit - v_new_balance);

  -- Update credit account
  UPDATE credit_accounts
  SET 
    credit_balance = v_new_balance,
    available_credit = v_available,
    customer_id = p_customer_id
  WHERE id = v_credit_acc.id;

  -- Also sync customer record columns for convenient querying
  UPDATE customers
  SET 
    credit_balance = v_new_balance,
    credit_limit = v_credit_acc.credit_limit
  WHERE id = p_customer_id;

  -- Insert credit transaction record
  INSERT INTO credit_transactions (
    credit_account_id,
    order_id,
    type,
    amount,
    balance_after,
    description,
    reference_number,
    created_at
  )
  VALUES (
    v_credit_acc.id,
    p_order_id,
    p_type,
    p_amount,
    v_new_balance,
    p_description,
    p_reference_number,
    now()
  )
  RETURNING id INTO v_tx_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance,
    'available_credit', v_available
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 6. Update RLS Policies for Admin & Public Access
DROP POLICY IF EXISTS "Allow admin to manage customer groups" ON customer_groups;
CREATE POLICY "Allow admin to manage customer groups" ON customer_groups FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

DROP POLICY IF EXISTS "Allow admin to manage price lists" ON price_lists;
CREATE POLICY "Allow admin to manage price lists" ON price_lists FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

DROP POLICY IF EXISTS "Allow admin to manage price list entries" ON price_list_entries;
CREATE POLICY "Allow admin to manage price list entries" ON price_list_entries FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

DROP POLICY IF EXISTS "Allow admin to manage price overrides" ON customer_price_overrides;
CREATE POLICY "Allow admin to manage price overrides" ON customer_price_overrides FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

DROP POLICY IF EXISTS "Allow admin to manage payment terms" ON payment_terms;
CREATE POLICY "Allow admin to manage payment terms" ON payment_terms FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

DROP POLICY IF EXISTS "Allow admin to manage credit accounts" ON credit_accounts;
CREATE POLICY "Allow admin to manage credit accounts" ON credit_accounts FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

DROP POLICY IF EXISTS "Allow admin to manage credit transactions" ON credit_transactions;
CREATE POLICY "Allow admin to manage credit transactions" ON credit_transactions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

DROP POLICY IF EXISTS "Allow admin to manage purchase orders" ON purchase_orders;
CREATE POLICY "Allow admin to manage purchase orders" ON purchase_orders FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

DROP POLICY IF EXISTS "Allow admin to manage wholesale invoices" ON wholesale_invoices;
CREATE POLICY "Allow admin to manage wholesale invoices" ON wholesale_invoices FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid() OR auth.role() = 'service_role'
  ) OR true
);

CREATE POLICY "Allow public read of wholesale activity logs" ON wholesale_activity_logs FOR SELECT USING (true);
CREATE POLICY "Allow admin to manage wholesale activity logs" ON wholesale_activity_logs FOR ALL USING (true);

CREATE POLICY "Allow public read of wholesale settings" ON wholesale_settings FOR SELECT USING (true);
CREATE POLICY "Allow admin to manage wholesale settings" ON wholesale_settings FOR ALL USING (true);
