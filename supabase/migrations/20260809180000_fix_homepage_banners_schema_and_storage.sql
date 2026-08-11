-- Migration to fix homepage_banners table schema and cms-images storage bucket & policies

-- 1. Create or update homepage_banners table
CREATE TABLE IF NOT EXISTS homepage_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  title_ar TEXT,
  title_fr TEXT,
  title_en TEXT,
  subtitle TEXT,
  subtitle_ar TEXT,
  subtitle_fr TEXT,
  subtitle_en TEXT,
  description_ar TEXT,
  description_fr TEXT,
  description_en TEXT,
  banner_type VARCHAR(50) DEFAULT 'hero',
  target_page VARCHAR(50) DEFAULT 'homepage',
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  button_text TEXT,
  button_text_ar TEXT,
  button_text_fr TEXT,
  button_text_en TEXT,
  button_link TEXT,
  button_color VARCHAR(50) DEFAULT '#4f46e5',
  text_color VARCHAR(50) DEFAULT '#ffffff',
  text_alignment VARCHAR(50) DEFAULT 'center',
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  desktop_visibility BOOLEAN DEFAULT true,
  mobile_visibility BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely ensure all columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'title_en') THEN
    ALTER TABLE homepage_banners ADD COLUMN title_en TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'subtitle_en') THEN
    ALTER TABLE homepage_banners ADD COLUMN subtitle_en TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'description_ar') THEN
    ALTER TABLE homepage_banners ADD COLUMN description_ar TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'description_fr') THEN
    ALTER TABLE homepage_banners ADD COLUMN description_fr TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'description_en') THEN
    ALTER TABLE homepage_banners ADD COLUMN description_en TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'banner_type') THEN
    ALTER TABLE homepage_banners ADD COLUMN banner_type VARCHAR(50) DEFAULT 'hero';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'target_page') THEN
    ALTER TABLE homepage_banners ADD COLUMN target_page VARCHAR(50) DEFAULT 'homepage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'button_text_en') THEN
    ALTER TABLE homepage_banners ADD COLUMN button_text_en TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'desktop_visibility') THEN
    ALTER TABLE homepage_banners ADD COLUMN desktop_visibility BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homepage_banners' AND column_name = 'mobile_visibility') THEN
    ALTER TABLE homepage_banners ADD COLUMN mobile_visibility BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_banners_order ON homepage_banners(display_order);
CREATE INDEX IF NOT EXISTS idx_banners_active ON homepage_banners(active);

-- Enable RLS
ALTER TABLE homepage_banners ENABLE ROW LEVEL SECURITY;

-- Database RLS Policies for homepage_banners
DROP POLICY IF EXISTS "banners_select_public" ON homepage_banners;
DROP POLICY IF EXISTS "banners_insert_admin" ON homepage_banners;
DROP POLICY IF EXISTS "banners_update_admin" ON homepage_banners;
DROP POLICY IF EXISTS "banners_delete_admin" ON homepage_banners;

CREATE POLICY "banners_select_public" ON homepage_banners FOR SELECT USING (true);
CREATE POLICY "banners_insert_admin" ON homepage_banners FOR INSERT WITH CHECK (true);
CREATE POLICY "banners_update_admin" ON homepage_banners FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "banners_delete_admin" ON homepage_banners FOR DELETE USING (true);

-- 2. Configure Storage Bucket for cms-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cms-images',
  'cms-images',
  true,
  26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage RLS Policies for cms-images
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
