/*
# Create Suppliers Table in Production Supabase
Creates public.suppliers table with complete RLS policies, constraints, and indexes.
*/

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
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by code and active status
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON public.suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers(is_active);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow all read operations for active/admin views
DROP POLICY IF EXISTS "suppliers_select_policy" ON public.suppliers;
CREATE POLICY "suppliers_select_policy" ON public.suppliers 
FOR SELECT USING (true);

-- Insert policy for authorized admin users
DROP POLICY IF EXISTS "suppliers_insert_policy" ON public.suppliers;
CREATE POLICY "suppliers_insert_policy" ON public.suppliers 
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' OR 
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()) OR
  auth.role() = 'service_role'
);

-- Update policy for authorized admin users
DROP POLICY IF EXISTS "suppliers_update_policy" ON public.suppliers;
CREATE POLICY "suppliers_update_policy" ON public.suppliers 
FOR UPDATE USING (
  auth.role() = 'authenticated' OR 
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()) OR
  auth.role() = 'service_role'
);

-- Delete policy for authorized admin users
DROP POLICY IF EXISTS "suppliers_delete_policy" ON public.suppliers;
CREATE POLICY "suppliers_delete_policy" ON public.suppliers 
FOR DELETE USING (
  auth.role() = 'authenticated' OR 
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()) OR
  auth.role() = 'service_role'
);
