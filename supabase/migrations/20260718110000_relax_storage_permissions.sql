-- Relax storage permissions to allow public upload, update, and delete access.
-- This ensures that both real Supabase Auth and local fallback admin users can upload images successfully.

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. product-images & products buckets policies
DROP POLICY IF EXISTS "product_images_select_all" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_all" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_all" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_all" ON storage.objects;
DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_admin" ON storage.objects;

CREATE POLICY "product_images_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images' OR bucket_id = 'products');

CREATE POLICY "product_images_insert_public" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'product-images' OR bucket_id = 'products');

CREATE POLICY "product_images_update_public" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'product-images' OR bucket_id = 'products')
  WITH CHECK (bucket_id = 'product-images' OR bucket_id = 'products');

CREATE POLICY "product_images_delete_public" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id = 'product-images' OR bucket_id = 'products');


-- 2. category-images & categories buckets policies
DROP POLICY IF EXISTS "category_images_select_all" ON storage.objects;
DROP POLICY IF EXISTS "category_images_insert_all" ON storage.objects;
DROP POLICY IF EXISTS "category_images_update_all" ON storage.objects;
DROP POLICY IF EXISTS "category_images_delete_all" ON storage.objects;
DROP POLICY IF EXISTS "category_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "category_images_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "category_images_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "category_images_delete_admin" ON storage.objects;
DROP POLICY IF EXISTS "category_images_insert_auth_backup" ON storage.objects;
DROP POLICY IF EXISTS "category_images_update_auth_backup" ON storage.objects;
DROP POLICY IF EXISTS "category_images_delete_auth_backup" ON storage.objects;
DROP POLICY IF EXISTS "category_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "category_images_insert_public" ON storage.objects;
DROP POLICY IF EXISTS "category_images_update_public" ON storage.objects;
DROP POLICY IF EXISTS "category_images_delete_public" ON storage.objects;

CREATE POLICY "category_images_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'category-images' OR bucket_id = 'categories');

CREATE POLICY "category_images_insert_public" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'category-images' OR bucket_id = 'categories');

CREATE POLICY "category_images_update_public" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'category-images' OR bucket_id = 'categories')
  WITH CHECK (bucket_id = 'category-images' OR bucket_id = 'categories');

CREATE POLICY "category_images_delete_public" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id = 'category-images' OR bucket_id = 'categories');


-- 3. cms-images & cms buckets policies
DROP POLICY IF EXISTS "cms_images_select_all" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_insert_all" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_update_all" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_delete_all" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_delete_admin" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_insert_auth_backup" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_update_auth_backup" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_delete_auth_backup" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_insert_public" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_update_public" ON storage.objects;
DROP POLICY IF EXISTS "cms_images_delete_public" ON storage.objects;

CREATE POLICY "cms_images_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'cms-images' OR bucket_id = 'cms');

CREATE POLICY "cms_images_insert_public" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'cms-images' OR bucket_id = 'cms');

CREATE POLICY "cms_images_update_public" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'cms-images' OR bucket_id = 'cms')
  WITH CHECK (bucket_id = 'cms-images' OR bucket_id = 'cms');

CREATE POLICY "cms_images_delete_public" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id = 'cms-images' OR bucket_id = 'cms');


-- 4. Enable RLS Self-Provision Policy on admin_profiles table
DROP POLICY IF EXISTS "Allow primary super admins to insert their own profile" ON admin_profiles;
CREATE POLICY "Allow primary super admins to insert their own profile" ON admin_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid() AND 
    (LOWER(email) = 'zakidj181@gmail.com' OR LOWER(email) = 'zakidj181@gmial.com')
  );
