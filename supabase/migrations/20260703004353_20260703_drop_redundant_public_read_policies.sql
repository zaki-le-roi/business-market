/*
# Remove redundant public-role SELECT policies

Several tables have TWO SELECT policies: an original `public`-role policy
(added in the first migration) and a later `anon, authenticated` policy
(added when admin SELECT was needed). The `public` role includes anon and
authenticated, so the original policies are redundant with the explicit ones
and produce avoidable scanner noise.

Dropped (redundant — an `anon, authenticated` SELECT policy already exists):
- products_public_read      (products_select_all exists)
- cms_read_active           (cms_select_all exists)
- coupons_read_active       (coupons_select_all exists)

Kept (no duplicate exists, and the predicate is meaningful):
- reviews_read_approved     (only SELECT policy; restricts to approved reviews)
- wilayas_public_read       (only SELECT policy; read-only reference table)

No data changes. Idempotent.
*/

DROP POLICY IF EXISTS "products_public_read" ON products;
DROP POLICY IF EXISTS "cms_read_active" ON cms_content;
DROP POLICY IF EXISTS "coupons_read_active" ON coupons;
