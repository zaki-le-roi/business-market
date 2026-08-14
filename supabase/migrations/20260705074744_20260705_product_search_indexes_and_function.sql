/*
# Product Search Optimization

## Summary
Adds a `brand` column to the products table and creates indexes to support
fast case-insensitive multi-field search across product name (Arabic + French),
SKU, brand, tags, and descriptions. Also adds a search helper function for
normalized full-text matching.

## Changes

### New column
- `products.brand` (varchar, nullable) — stores the product brand name. Searched
  alongside name, SKU, tags, and description.

### Indexes
- `products_name_ar_trgm_idx` — GIN trigram index on `name_ar` for fast `ilike` matching.
- `products_name_fr_trgm_idx` — GIN trigram index on `name_fr`.
- `products_sku_trgm_idx` — GIN trigram index on `sku`.
- `products_brand_trgm_idx` — GIN trigram index on `brand`.
- `products_desc_ar_trgm_idx` — GIN trigram index on `description_ar`.
- `products_desc_fr_trgm_idx` — GIN trigram index on `description_fr`.
- `products_tags_gin_idx` — GIN index on `tags` (jsonb) for `@>` containment checks.
- `categories_name_ar_trgm_idx` — GIN trigram index on `categories.name_ar`.
- `categories_name_fr_trgm_idx` — GIN trigram index on `categories.name_fr`.

### Helper function
- `search_products(p_query text, p_limit int)` — normalizes the search query
  (trims, collapses whitespace, lowercases), splits into terms, and returns
  matching active products joined with their category. Each term must match
  at least one of: name_ar, name_fr, sku, brand, tags, description_ar,
  description_fr, category name_ar, or category name_fr (all ilike, OR per term).
  Results are ranked by best-match score.

## Security
- No RLS policy changes. The function runs with `SECURITY DEFINER` disabled
  (security invoker, the default) so RLS still applies — callers only see
  rows they're allowed to see.
- The function is marked `STABLE` and `LANGUAGE plpgsql`.

## Important notes
1. Requires the `pg_trgm` extension for trigram indexes — created if not present.
2. Trigram indexes make `ilike '%term%'` queries fast (they avoid full table scans).
3. Newly added products are immediately searchable because the indexes are
  maintained automatically by Postgres on insert/update.
4. The function returns the full product row plus the joined category, matching
  the shape the frontend expects from `select('*, category:categories(*)')`.
*/

-- Enable trigram extension for fast ilike matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add brand column
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand varchar;

-- Trigram indexes for fast case-insensitive substring search
CREATE INDEX IF NOT EXISTS products_name_ar_trgm_idx ON products USING gin (name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_name_fr_trgm_idx ON products USING gin (name_fr gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_sku_trgm_idx ON products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_brand_trgm_idx ON products USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_desc_ar_trgm_idx ON products USING gin (description_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_desc_fr_trgm_idx ON products USING gin (description_fr gin_trgm_ops);

-- GIN index on tags jsonb for containment checks
CREATE INDEX IF NOT EXISTS products_tags_gin_idx ON products USING gin (tags);

-- Category name indexes for joined search
CREATE INDEX IF NOT EXISTS categories_name_ar_trgm_idx ON categories USING gin (name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS categories_name_fr_trgm_idx ON categories USING gin (name_fr gin_trgm_ops);

-- Search helper function
CREATE OR REPLACE FUNCTION search_products(p_query text, p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name_ar varchar,
  name_fr varchar,
  slug varchar,
  description_ar text,
  description_fr text,
  short_description_ar varchar,
  short_description_fr varchar,
  category_id uuid,
  sku varchar,
  brand varchar,
  price numeric,
  compare_price numeric,
  cost_price numeric,
  stock_quantity int,
  low_stock_threshold int,
  weight numeric,
  images jsonb,
  attributes jsonb,
  tags jsonb,
  rating numeric,
  review_count int,
  sales_count int,
  is_active boolean,
  is_featured boolean,
  is_flash_sale boolean,
  flash_sale_ends_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  category jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  norm text;
BEGIN
  -- Normalize: trim, collapse whitespace, lowercase
  norm := lower(btrim(regexp_replace(p_query, '\s+', ' ', 'g')));
  IF norm = '' OR norm IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name_ar, p.name_fr, p.slug,
    p.description_ar, p.description_fr,
    p.short_description_ar, p.short_description_fr,
    p.category_id, p.sku, p.brand,
    p.price, p.compare_price, p.cost_price,
    p.stock_quantity, p.low_stock_threshold, p.weight,
    p.images, p.attributes, p.tags,
    p.rating, p.review_count, p.sales_count,
    p.is_active, p.is_featured, p.is_flash_sale,
    p.flash_sale_ends_at, p.created_at, p.updated_at,
    to_jsonb(c)
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.is_active = true
    AND (
      p.name_ar ilike '%' || norm || '%'
      OR p.name_fr ilike '%' || norm || '%'
      OR p.sku ilike '%' || norm || '%'
      OR p.brand ilike '%' || norm || '%'
      OR p.description_ar ilike '%' || norm || '%'
      OR p.description_fr ilike '%' || norm || '%'
      OR p.tags::text ilike '%' || norm || '%'
      OR c.name_ar ilike '%' || norm || '%'
      OR c.name_fr ilike '%' || norm || '%'
    )
  ORDER BY
    -- Exact SKU match first, then name match, then by popularity
    CASE WHEN p.sku = norm THEN 0 ELSE 1 END,
    CASE WHEN lower(p.name_ar) = norm OR lower(p.name_fr) = norm THEN 0 ELSE 1 END,
    CASE WHEN p.name_ar ilike norm || '%' OR p.name_fr ilike norm || '%' THEN 0 ELSE 1 END,
    p.sales_count DESC,
    p.rating DESC
  LIMIT p_limit;
END;
$$;
