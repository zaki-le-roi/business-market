-- Migration: Create meta_data_deletion_requests table with hardened security & RLS
CREATE TABLE IF NOT EXISTS public.meta_data_deletion_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    confirmation_code TEXT UNIQUE NOT NULL,
    meta_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    details JSONB DEFAULT '{}'::jsonb,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookup by code and user ID
CREATE INDEX IF NOT EXISTS idx_meta_deletion_code ON public.meta_data_deletion_requests(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_meta_deletion_user_id ON public.meta_data_deletion_requests(meta_user_id);

-- Ensure public.is_admin() helper function exists with hardened search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.admin_profiles
        WHERE id = auth.uid() AND is_active = true
      )
      OR EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = auth.uid()
      )
    )
  );
END;
$$;

--------------------------------------------------------------------------------
-- HARDENED SYSTEM_SETTINGS RLS POLICIES
-- Prevents anon and non-admin authenticated users from reading private settings
-- such as meta_social_commerce_config or any setting with is_public = false
--------------------------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read_all" ON public.system_settings;
DROP POLICY IF EXISTS "settings_read_public" ON public.system_settings;
DROP POLICY IF EXISTS "settings_select_public" ON public.system_settings;
DROP POLICY IF EXISTS "settings_select_admin" ON public.system_settings;

-- 1. Public settings SELECT policy: Only rows where is_public = true AND key <> 'meta_social_commerce_config'
CREATE POLICY "settings_select_public"
ON public.system_settings
FOR SELECT
TO anon, authenticated
USING (is_public = true AND key <> 'meta_social_commerce_config');

-- 2. Admin settings SELECT policy: Only admin users matching public.is_admin() can read all settings
CREATE POLICY "settings_select_admin"
ON public.system_settings
FOR SELECT
TO authenticated
USING (public.is_admin());

--------------------------------------------------------------------------------
-- META_DATA_DELETION_REQUESTS RLS POLICIES
--------------------------------------------------------------------------------
ALTER TABLE public.meta_data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_deletion_public_read" ON public.meta_data_deletion_requests;
DROP POLICY IF EXISTS "meta_deletion_insert" ON public.meta_data_deletion_requests;
DROP POLICY IF EXISTS "meta_deletion_update" ON public.meta_data_deletion_requests;
DROP POLICY IF EXISTS "meta_deletion_admin_select" ON public.meta_data_deletion_requests;
DROP POLICY IF EXISTS "meta_deletion_public_select_by_code" ON public.meta_data_deletion_requests;
DROP POLICY IF EXISTS "meta_deletion_validated_insert" ON public.meta_data_deletion_requests;
DROP POLICY IF EXISTS "meta_deletion_admin_insert" ON public.meta_data_deletion_requests;
DROP POLICY IF EXISTS "meta_deletion_admin_update" ON public.meta_data_deletion_requests;
DROP POLICY IF EXISTS "meta_deletion_admin_delete" ON public.meta_data_deletion_requests;

CREATE POLICY "meta_deletion_admin_select"
ON public.meta_data_deletion_requests FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "meta_deletion_admin_insert"
ON public.meta_data_deletion_requests FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "meta_deletion_admin_update"
ON public.meta_data_deletion_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "meta_deletion_admin_delete"
ON public.meta_data_deletion_requests FOR DELETE TO authenticated USING (public.is_admin());

--------------------------------------------------------------------------------
-- PUBLIC STATUS LOOKUP RPC FUNCTION
-- CRITICAL SECURITY RULE: NEVER exposes meta_user_id, details, or internal DB ids
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_meta_deletion_status(p_code TEXT)
RETURNS TABLE (
  confirmation_code TEXT,
  status TEXT,
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Strict input validation on confirmation code format (must be DEL- followed by uppercase hex)
  IF p_code IS NULL OR p_code !~ '^DEL-[A-F0-9]{12,64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    m.confirmation_code,
    m.status,
    m.requested_at,
    m.completed_at
  FROM public.meta_data_deletion_requests m
  WHERE m.confirmation_code = UPPER(TRIM(p_code));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meta_deletion_status(TEXT) TO anon, authenticated;

--------------------------------------------------------------------------------
-- PROTECTED DELETION RECORDING RPC FUNCTION
-- p_issued_at is TRULY MANDATORY (no DEFAULT). Unconditional HMAC verification.
--------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.record_meta_data_deletion(
  p_confirmation_code TEXT,
  p_meta_user_id TEXT,
  p_details JSONB,
  p_server_proof TEXT,
  p_issued_at BIGINT
)
RETURNS TABLE (
  id TEXT,
  confirmation_code TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app_secret TEXT;
  v_expected_proof TEXT;
  v_rec_id TEXT;
  v_now_epoch BIGINT;
BEGIN
  -- 1. Input Sanitization & Bounds Validation
  IF p_confirmation_code IS NULL OR p_confirmation_code !~ '^DEL-[A-F0-9]{12,64}$' THEN
    RAISE EXCEPTION 'Invalid confirmation code format.';
  END IF;

  IF p_meta_user_id IS NULL OR TRIM(p_meta_user_id) = '' THEN
    RAISE EXCEPTION 'Invalid Meta User ID parameter.';
  END IF;

  IF p_server_proof IS NULL OR LENGTH(TRIM(p_server_proof)) != 64 THEN
    RAISE EXCEPTION 'Invalid or missing server verification proof.';
  END IF;

  -- 2. MANDATORY Timestamp Freshness Validation (p_issued_at cannot be null or <= 0, max age 1 hour)
  IF p_issued_at IS NULL OR p_issued_at <= 0 THEN
    RAISE EXCEPTION 'Unauthorized deletion attempt: Missing or invalid issued_at timestamp parameter.';
  END IF;

  v_now_epoch := EXTRACT(EPOCH FROM NOW())::BIGINT;
  IF (v_now_epoch - p_issued_at) > 3600 OR (v_now_epoch - p_issued_at) < -300 THEN
    RAISE EXCEPTION 'Unauthorized deletion attempt: Invalid or expired issued_at timestamp.';
  END IF;

  -- 3. Retrieve App Secret from system settings
  SELECT (value->>'appSecret') INTO v_app_secret
  FROM public.system_settings
  WHERE key = 'meta_social_commerce_config'
  LIMIT 1;

  -- MANDATORY: App Secret MUST be configured. Never allow missing secret to bypass authentication!
  IF v_app_secret IS NULL OR TRIM(v_app_secret) = '' THEN
    RAISE EXCEPTION 'Unauthorized deletion attempt: Meta App Secret is not configured in database settings.';
  END IF;

  -- 4. Mandatory HMAC-SHA256 signature verification
  v_expected_proof := encode(
    hmac(
      ('META_DELETE_PROOF_V2:' || UPPER(TRIM(p_confirmation_code)) || ':' || TRIM(p_meta_user_id) || ':' || p_issued_at::text)::bytea,
      v_app_secret::bytea,
      'sha256'
    ),
    'hex'
  );

  IF LOWER(TRIM(p_server_proof)) != LOWER(v_expected_proof) THEN
    RAISE EXCEPTION 'Unauthorized deletion attempt: Invalid server HMAC-SHA256 proof.';
  END IF;

  -- 5. Upsert into meta_data_deletion_requests
  INSERT INTO public.meta_data_deletion_requests (
    confirmation_code,
    meta_user_id,
    status,
    details,
    requested_at,
    completed_at
  ) VALUES (
    UPPER(TRIM(p_confirmation_code)),
    TRIM(p_meta_user_id),
    'completed',
    COALESCE(p_details, '{}'::jsonb),
    NOW(),
    NOW()
  )
  ON CONFLICT (confirmation_code) DO UPDATE
    SET status = 'completed',
        details = EXCLUDED.details,
        completed_at = NOW(),
        updated_at = NOW()
  RETURNING meta_data_deletion_requests.id INTO v_rec_id;

  -- 6. Anonymize/Clean matching customer profiles if present
  UPDATE public.customers
  SET name = 'Anonymized User',
      email = 'deleted-' || UPPER(TRIM(p_confirmation_code)) || '@anonymized.invalid',
      phone = '0000000000',
      updated_at = NOW()
  WHERE notes LIKE '%' || TRIM(p_meta_user_id) || '%';

  RETURN QUERY
  SELECT 
    v_rec_id,
    UPPER(TRIM(p_confirmation_code)),
    'completed'::TEXT;
END;
$$;

-- Revoke direct public execution on deletion RPC to enforce server-only access
REVOKE EXECUTE ON FUNCTION public.record_meta_data_deletion(TEXT, TEXT, JSONB, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_meta_data_deletion(TEXT, TEXT, JSONB, TEXT, BIGINT) TO service_role, postgres;
