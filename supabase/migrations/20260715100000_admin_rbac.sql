-- Create Admin Roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default roles
INSERT INTO admin_roles (id, name, permissions) VALUES
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
('product-manager', 'Product Manager', ARRAY[
  'manage_products', 'manage_categories'
]),
('order-manager', 'Order Manager', ARRAY[
  'manage_orders', 'manage_shipping'
]),
('customer-support', 'Customer Support', ARRAY[
  'manage_customers', 'manage_support'
]),
('warehouse-manager', 'Warehouse Manager', ARRAY[
  'manage_products', 'manage_orders', 'manage_shipping'
]),
('marketing-manager', 'Marketing Manager', ARRAY[
  'manage_discounts', 'manage_coupons'
]),
('accountant', 'Accountant', ARRAY[
  'manage_reports'
])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  permissions = EXCLUDED.permissions;

-- Create Admin Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role_id TEXT REFERENCES admin_roles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for security
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to admin_roles for authenticated users
DROP POLICY IF EXISTS "Allow authenticated read of roles" ON admin_roles;
CREATE POLICY "Allow authenticated read of roles" ON admin_roles
  FOR SELECT TO public USING (true);

-- Allow super admins to manage roles
DROP POLICY IF EXISTS "Allow super-admins full access to roles" ON admin_roles;
CREATE POLICY "Allow super-admins full access to roles" ON admin_roles
  FOR ALL TO public USING (
    EXISTS (
      SELECT 1 FROM admin_profiles 
      WHERE admin_profiles.id = auth.uid() AND admin_profiles.role_id = 'super-admin'
    )
  );

-- Allow admins to read profiles
DROP POLICY IF EXISTS "Allow authenticated read of admin profiles" ON admin_profiles;
CREATE POLICY "Allow authenticated read of admin profiles" ON admin_profiles
  FOR SELECT TO public USING (true);

-- Allow super admins to manage admin profiles
DROP POLICY IF EXISTS "Allow super-admins full access to admin profiles" ON admin_profiles;
CREATE POLICY "Allow super-admins full access to admin profiles" ON admin_profiles
  FOR ALL TO public USING (
    EXISTS (
      SELECT 1 FROM admin_profiles 
      WHERE admin_profiles.id = auth.uid() AND admin_profiles.role_id = 'super-admin'
    )
  );
