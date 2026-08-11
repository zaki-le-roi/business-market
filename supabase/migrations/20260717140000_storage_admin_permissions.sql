-- Ensure storage.buckets exist and are public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'category-images',
  'category-images',
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

-- Clean up any old broad policies
DROP POLICY IF EXISTS "product_images_insert_all" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_all" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_all" ON storage.objects;
DROP POLICY IF EXISTS "category_images_insert_all" ON storage.objects;
DROP POLICY IF EXISTS "category_images_update_all" ON storage.objects;
DROP POLICY IF EXISTS "category_images_delete_all" ON storage.objects;

-- Create secure policies for product-images (authenticated admin users)
CREATE POLICY "product_images_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "product_images_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'product-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "product_images_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- Create secure policies for category-images (authenticated admin users)
CREATE POLICY "category_images_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'category-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- Create backup policies in case admin_profiles is empty or not seeded for some admins during setup
CREATE POLICY "category_images_insert_auth_backup" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'category-images');

CREATE POLICY "category_images_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'category-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'category-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "category_images_update_auth_backup" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'category-images')
  WITH CHECK (bucket_id = 'category-images');

CREATE POLICY "category_images_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'category-images' AND 
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "category_images_delete_auth_backup" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'category-images');

-- Ensure public select policies are active so storefront can access URLs
DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
CREATE POLICY "product_images_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "category_images_select_public" ON storage.objects;
CREATE POLICY "category_images_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'category-images');
