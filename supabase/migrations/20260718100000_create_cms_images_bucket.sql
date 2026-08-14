-- Create storage bucket for cms-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cms-images',
  'cms-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable RLS on storage.objects if not enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Clean up any old broad policies for cms-images
DROP POLICY IF EXISTS "cms_images_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_delete_admin" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_insert_auth_backup" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_update_auth_backup" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_delete_auth_backup" ON storage.objects;

-- Create secure policies for cms-images (authenticated admin users)
CREATE POLICY "cms_images_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cms-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- Create backup policies in case admin_profiles is empty or not seeded for some admins during setup
CREATE POLICY "cms_images_insert_auth_backup" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cms-images');

CREATE POLICY "cms_images_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cms-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'cms-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "cms_images_update_auth_backup" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cms-images')
  WITH CHECK (bucket_id = 'cms-images');

CREATE POLICY "cms_images_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cms-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "cms_images_delete_auth_backup" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cms-images');

-- Ensure public select policies are active so storefront can access URLs
CREATE POLICY "cms_images_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'cms-images');
