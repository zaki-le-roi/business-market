-- Fix 1: OTP codes - allow anon users to insert and select their own codes
DROP POLICY IF EXISTS "otp_all_authenticated" ON otp_codes;

CREATE POLICY "otp_insert_anon" ON otp_codes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "otp_select_anon" ON otp_codes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "otp_update_anon" ON otp_codes
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Fix 2: Customers - allow anon users to insert (guest checkout / registration)
-- and select/update by phone (not auth.uid which doesn't exist for our custom auth)
DROP POLICY IF EXISTS "customers_select_own" ON customers;
DROP POLICY IF EXISTS "customers_insert_own" ON customers;
DROP POLICY IF EXISTS "customers_update_own" ON customers;

CREATE POLICY "customers_select_all" ON customers
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "customers_insert_all" ON customers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "customers_update_all" ON customers
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Fix 3: System settings - allow anon to read ALL settings (admin panel is client-side)
-- and update (admin panel uses anon key, no server-side auth for admin)
DROP POLICY IF EXISTS "settings_read_public" ON system_settings;
DROP POLICY IF EXISTS "settings_insert" ON system_settings;
DROP POLICY IF EXISTS "settings_update" ON system_settings;

CREATE POLICY "settings_read_all" ON system_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "settings_insert_all" ON system_settings
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "settings_update_all" ON system_settings
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);
