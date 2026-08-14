-- Migration: 20260810140000_create_cms_v2_schema.sql
-- Description: CMS v2 Enterprise Schema Migration with pages, media, revisions, page views, and activity logging

BEGIN;

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_page_status') THEN
        CREATE TYPE cms_page_status AS ENUM ('published', 'draft', 'scheduled');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_page_type') THEN
        CREATE TYPE cms_page_type AS ENUM (
            'static_about',
            'static_contact',
            'static_privacy',
            'static_terms',
            'static_returns',
            'static_shipping',
            'static_faq',
            'custom'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_media_file_type') THEN
        CREATE TYPE cms_media_file_type AS ENUM ('image', 'pdf', 'video', 'document');
    END IF;
END $$;

-- 2. CMS PAGES TABLE
CREATE TABLE IF NOT EXISTS public.cms_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    type cms_page_type NOT NULL DEFAULT 'custom',
    title_ar TEXT NOT NULL DEFAULT '',
    title_fr TEXT NOT NULL DEFAULT '',
    title_en TEXT NOT NULL DEFAULT '',
    content_ar TEXT NOT NULL DEFAULT '',
    content_fr TEXT NOT NULL DEFAULT '',
    content_en TEXT NOT NULL DEFAULT '',
    status cms_page_status NOT NULL DEFAULT 'draft',
    publish_date TIMESTAMPTZ,
    seo JSONB NOT NULL DEFAULT '{}'::jsonb,
    author TEXT DEFAULT 'Admin',
    view_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for cms_pages
CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON public.cms_pages(slug);
CREATE INDEX IF NOT EXISTS idx_cms_pages_key ON public.cms_pages(key);
CREATE INDEX IF NOT EXISTS idx_cms_pages_status ON public.cms_pages(status);
CREATE INDEX IF NOT EXISTS idx_cms_pages_type ON public.cms_pages(type);

-- 3. CMS MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.cms_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    title_ar TEXT,
    title_fr TEXT,
    title_en TEXT,
    description_ar TEXT,
    description_fr TEXT,
    folder VARCHAR(255) NOT NULL DEFAULT '/',
    file_type cms_media_file_type NOT NULL DEFAULT 'image',
    url TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    dimensions VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'published',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_media_folder ON public.cms_media(folder);
CREATE INDEX IF NOT EXISTS idx_cms_media_file_type ON public.cms_media(file_type);

-- 4. CMS PAGE REVISIONS TABLE
CREATE TABLE IF NOT EXISTS public.cms_page_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    author TEXT DEFAULT 'Admin',
    title_ar TEXT NOT NULL,
    title_fr TEXT NOT NULL,
    title_en TEXT NOT NULL,
    content_ar TEXT NOT NULL,
    content_fr TEXT NOT NULL,
    content_en TEXT NOT NULL,
    status cms_page_status NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_page_revision_version UNIQUE (page_id, version)
);

CREATE INDEX IF NOT EXISTS idx_cms_page_revisions_page_id ON public.cms_page_revisions(page_id);

-- 5. CMS PAGE VIEWS TABLE (Concurrency & Analytics)
CREATE TABLE IF NOT EXISTS public.cms_page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    ip_hash VARCHAR(64),
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_page_session_window UNIQUE (page_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_page_views_page_id ON public.cms_page_views(page_id);

-- 6. CMS ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.cms_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    entity_type VARCHAR(50) NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "user" VARCHAR(255) NOT NULL DEFAULT 'Admin',
    ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_cms_activity_logs_timestamp ON public.cms_activity_logs(timestamp DESC);

-- 7. AUTOMATIC UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.fn_set_cms_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cms_pages_updated_at ON public.cms_pages;
CREATE TRIGGER trg_cms_pages_updated_at
    BEFORE UPDATE ON public.cms_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_cms_updated_at();

DROP TRIGGER IF EXISTS trg_cms_media_updated_at ON public.cms_media;
CREATE TRIGGER trg_cms_media_updated_at
    BEFORE UPDATE ON public.cms_media
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_cms_updated_at();

-- 8. REVISION SNAPSHOT TRIGGER FOR CMS PAGES
CREATE OR REPLACE FUNCTION public.fn_cms_page_revision_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_ver INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1
    INTO next_ver
    FROM public.cms_page_revisions
    WHERE page_id = NEW.id;

    INSERT INTO public.cms_page_revisions (
        page_id,
        version,
        timestamp,
        author,
        title_ar,
        title_fr,
        title_en,
        content_ar,
        content_fr,
        content_en,
        status,
        note
    ) VALUES (
        NEW.id,
        next_ver,
        NOW(),
        COALESCE(NEW.author, 'Admin'),
        NEW.title_ar,
        NEW.title_fr,
        NEW.title_en,
        NEW.content_ar,
        NEW.content_fr,
        NEW.content_en,
        NEW.status,
        'Auto-snapshot on page update'
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cms_page_revision_snapshot ON public.cms_pages;
CREATE TRIGGER trg_cms_page_revision_snapshot
    AFTER INSERT OR UPDATE ON public.cms_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cms_page_revision_snapshot();

-- 9. SAFE DATA MIGRATION FROM OLD cms_content TO cms_pages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cms_content') THEN
        INSERT INTO public.cms_pages (
            id,
            key,
            slug,
            type,
            title_ar,
            title_fr,
            title_en,
            content_ar,
            content_fr,
            content_en,
            status,
            publish_date,
            seo,
            author,
            view_count,
            created_at,
            updated_at
        )
        SELECT
            c.id,
            c.key,
            COALESCE(c.metadata->>'slug', c.key) AS slug,
            CASE 
                WHEN c.key LIKE 'static_%' OR (c.metadata->>'type') IN ('static_about','static_contact','static_privacy','static_terms','static_returns','static_shipping','static_faq')
                THEN COALESCE((c.metadata->>'type')::cms_page_type, 'custom'::cms_page_type)
                ELSE 'custom'::cms_page_type
            END AS type,
            COALESCE(c.title_ar, '') AS title_ar,
            COALESCE(c.title_fr, '') AS title_fr,
            COALESCE(c.metadata->>'title_en', c.title_fr, '') AS title_en,
            COALESCE(c.content_ar, '') AS content_ar,
            COALESCE(c.content_fr, '') AS content_fr,
            COALESCE(c.metadata->>'content_en', c.content_fr, '') AS content_en,
            CASE WHEN c.is_active = true THEN 'published'::cms_page_status ELSE 'draft'::cms_page_status END AS status,
            CASE WHEN (c.metadata->>'publish_date') IS NOT NULL AND (c.metadata->>'publish_date') != '' THEN (c.metadata->>'publish_date')::timestamptz ELSE NULL END AS publish_date,
            COALESCE(c.metadata->'seo', '{}'::jsonb) AS seo,
            COALESCE(c.metadata->>'author', 'Admin') AS author,
            COALESCE((c.metadata->>'view_count')::bigint, 0) AS view_count,
            COALESCE(c.created_at, NOW()) AS created_at,
            COALESCE(c.updated_at, NOW()) AS updated_at
        FROM public.cms_content c
        WHERE 
            c.type = 'page' 
            OR c.key LIKE 'page_%' 
            OR c.key LIKE 'static_%'
            OR (c.metadata->>'slug') IS NOT NULL
        ON CONFLICT (id) DO NOTHING
        ON CONFLICT (key) DO NOTHING
        ON CONFLICT (slug) DO NOTHING;
    END IF;
END $$;

-- 10. RPC: RECORD PAGE VIEW (Protected against duplicate counts & concurrency)
CREATE OR REPLACE FUNCTION public.record_cms_page_view(
    p_page_id UUID,
    p_session_id VARCHAR(255)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.cms_page_views (page_id, session_id)
    VALUES (p_page_id, p_session_id)
    ON CONFLICT (page_id, session_id) DO NOTHING;

    IF FOUND THEN
        UPDATE public.cms_pages
        SET view_count = view_count + 1
        WHERE id = p_page_id;
    END IF;
END;
$$;

-- 11. ENABLE RLS POLICIES
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_activity_logs ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "Public can view published CMS pages" ON public.cms_pages;
CREATE POLICY "Public can view published CMS pages" ON public.cms_pages
    FOR SELECT USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert CMS pages" ON public.cms_pages;
CREATE POLICY "Admins can insert CMS pages" ON public.cms_pages
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update CMS pages" ON public.cms_pages;
CREATE POLICY "Admins can update CMS pages" ON public.cms_pages
    FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete CMS pages" ON public.cms_pages;
CREATE POLICY "Admins can delete CMS pages" ON public.cms_pages
    FOR DELETE USING (public.is_admin());

-- Media policies
DROP POLICY IF EXISTS "Public can view active CMS media" ON public.cms_media;
CREATE POLICY "Public can view active CMS media" ON public.cms_media
    FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert CMS media" ON public.cms_media;
CREATE POLICY "Admins can insert CMS media" ON public.cms_media
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update CMS media" ON public.cms_media;
CREATE POLICY "Admins can update CMS media" ON public.cms_media
    FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete CMS media" ON public.cms_media;
CREATE POLICY "Admins can delete CMS media" ON public.cms_media
    FOR DELETE USING (public.is_admin());

-- Revisions policies
DROP POLICY IF EXISTS "Admins can view CMS page revisions" ON public.cms_page_revisions;
CREATE POLICY "Admins can view CMS page revisions" ON public.cms_page_revisions
    FOR SELECT USING (public.is_admin());

-- Activity log policies
DROP POLICY IF EXISTS "Admins can view CMS activity logs" ON public.cms_activity_logs;
CREATE POLICY "Admins can view CMS activity logs" ON public.cms_activity_logs
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert CMS activity logs" ON public.cms_activity_logs;
CREATE POLICY "Admins can insert CMS activity logs" ON public.cms_activity_logs
    FOR INSERT WITH CHECK (public.is_admin());

COMMIT;
