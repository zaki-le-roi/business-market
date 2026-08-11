-- Create public.admin_users table if it doesn't exist to satisfy admin RLS policies
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'super_admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read admin_users
DROP POLICY IF EXISTS "Allow authenticated read of admin_users" ON public.admin_users;
CREATE POLICY "Allow authenticated read of admin_users" ON public.admin_users
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated user to manage their own admin_users record
DROP POLICY IF EXISTS "Allow authenticated self management of admin_users" ON public.admin_users;
CREATE POLICY "Allow authenticated self management of admin_users" ON public.admin_users
  FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Populate admin_users from existing auth.users
INSERT INTO public.admin_users (id, email, role, is_active)
SELECT id, email, 'super_admin', true
FROM auth.users
ON CONFLICT (id) DO UPDATE SET 
  role = 'super_admin',
  is_active = true;

-- Also sync to admin_profiles if table exists
INSERT INTO public.admin_profiles (id, email, role_id, is_active)
SELECT id, email, 'super-admin', true
FROM auth.users
ON CONFLICT (id) DO UPDATE SET 
  role_id = 'super-admin',
  is_active = true;

-- Create trigger function to keep admin_users and admin_profiles populated for future users
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
