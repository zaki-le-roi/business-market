-- Create homepage_banners table
CREATE TABLE homepage_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  title_ar TEXT,
  title_fr TEXT,
  subtitle TEXT,
  subtitle_ar TEXT,
  subtitle_fr TEXT,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  button_text TEXT,
  button_text_ar TEXT,
  button_text_fr TEXT,
  button_link TEXT,
  button_color VARCHAR(50) DEFAULT '#4f46e5',
  text_color VARCHAR(50) DEFAULT '#ffffff',
  text_alignment VARCHAR(50) DEFAULT 'center',
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_banners_order ON homepage_banners(display_order);
CREATE INDEX idx_banners_active ON homepage_banners(active);

-- Enable RLS
ALTER TABLE homepage_banners ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "banners_select_public" ON homepage_banners FOR SELECT USING (true);
CREATE POLICY "banners_insert_admin" ON homepage_banners FOR INSERT WITH CHECK (true);
CREATE POLICY "banners_update_admin" ON homepage_banners FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "banners_delete_admin" ON homepage_banners FOR DELETE USING (true);
