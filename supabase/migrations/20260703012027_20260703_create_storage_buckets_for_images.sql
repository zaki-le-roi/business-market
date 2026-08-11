/*
# Create Storage buckets for product and category images

## New Storage buckets
- `product-images` — public read, anon/authenticated write. Stores product
  gallery images (JPG, PNG, WebP, AVIF). 5 MB file size limit.
- `category-images` — public read, anon/authenticated write. Stores category
  icons/cover images. 5 MB file size limit.

## Security (Storage RLS policies)
Both buckets are public-readable (anyone can fetch the image by URL — required
for storefront display) and allow anon + authenticated to INSERT/UPDATE/DELETE
objects. This matches the no-auth (anon-key) architecture of the app: the admin
panel uploads via the anon key.

## Important notes
1. Buckets are created with `public = true` so object URLs are accessible
   without signed tokens — required for `<img src>` in the storefront.
2. MIME types are validated client-side (JPG/PNG/WebP/AVIF) and the 5 MB limit
   is enforced both in the bucket config and in the upload UI.
3. Idempotent: uses `INSERT ... ON CONFLICT DO NOTHING` for bucket creation.
*/

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

-- Storage RLS: allow anon + authenticated to CRUD objects in both buckets
DROP POLICY IF EXISTS "product_images_read_all" ON storage.objects;
CREATE POLICY "product_images_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_insert_all" ON storage.objects;
CREATE POLICY "product_images_insert_all" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_update_all" ON storage.objects;
CREATE POLICY "product_images_update_all" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_delete_all" ON storage.objects;
CREATE POLICY "product_images_delete_all" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "category_images_read_all" ON storage.objects;
CREATE POLICY "category_images_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'category-images');

DROP POLICY IF EXISTS "category_images_insert_all" ON storage.objects;
CREATE POLICY "category_images_insert_all" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'category-images');

DROP POLICY IF EXISTS "category_images_update_all" ON storage.objects;
CREATE POLICY "category_images_update_all" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'category-images') WITH CHECK (bucket_id = 'category-images');

DROP POLICY IF EXISTS "category_images_delete_all" ON storage.objects;
CREATE POLICY "category_images_delete_all" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'category-images');
