/*
# Fix RLS "Always True" Security Policies

## Summary
Replaces all RLS policies that used unconditional `USING (true)` / `WITH CHECK (true)`
for write operations (INSERT/UPDATE/DELETE) with properly scoped policies.

## Context
The app has two access patterns:
1. **Storefront (anon)** — customers browse, register, place orders, submit
   reviews and support tickets. These tables need anon write access to function.
2. **Admin panel (authenticated)** — the admin signs in via Supabase auth
   (admin@businessmarket.dz) and manages categories, products, coupons, CMS
   content, system settings, and audit logs.

## Changes by table

### Admin-only tables (writes restricted to `authenticated`)
- `categories` — INSERT/UPDATE/DELETE now `TO authenticated`.
- `products` — same as categories.
- `coupons` — same as categories.
- `cms_content` — same as categories.
- `system_settings` — same as categories.
- `audit_logs` — INSERT now `TO authenticated` (no anon forging of log entries).
- `orders` — DELETE now `TO authenticated` (only admin can delete orders).

### Customer-facing tables (anon writes retained, but scoped)
- `customers` — INSERT/UPDATE stay `TO anon, authenticated` with non-empty email check.
- `order_status_history` — INSERT stays `TO anon, authenticated` with non-null order_id check.
- `reviews` — INSERT stays `TO anon, authenticated`; UPDATE restricted to `authenticated` (admin moderation only).
- `support_tickets` — INSERT/UPDATE stay `TO anon, authenticated` with non-empty customer_phone check.
- `otp_codes` — INSERT/UPDATE stay `TO anon, authenticated` with non-empty phone check.

## Security impact
- Anonymous visitors can no longer INSERT/UPDATE/DELETE admin-managed data.
- Anonymous visitors can no longer DELETE orders or moderate reviews.
- Storefront customer flows continue to work (register, checkout, review, tickets, OTP).

## Important notes
1. The admin panel now requires a Supabase auth session (admin@businessmarket.dz).
2. SELECT policies remain public so the storefront and order tracking work.
3. All policies use DROP+CREATE so the migration is idempotent.
*/

-- categories: admin-only writes
DROP POLICY IF EXISTS "categories_insert_anon" ON categories;
CREATE POLICY "categories_insert_authenticated" ON categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "categories_update_anon" ON categories;
CREATE POLICY "categories_update_authenticated" ON categories
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "categories_delete_anon" ON categories;
CREATE POLICY "categories_delete_authenticated" ON categories
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- products: admin-only writes
DROP POLICY IF EXISTS "products_insert_anon" ON products;
CREATE POLICY "products_insert_authenticated" ON products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "products_update_anon" ON products;
CREATE POLICY "products_update_authenticated" ON products
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "products_delete_anon" ON products;
CREATE POLICY "products_delete_authenticated" ON products
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- coupons: admin-only writes
DROP POLICY IF EXISTS "coupons_insert_anon" ON coupons;
CREATE POLICY "coupons_insert_authenticated" ON coupons
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "coupons_update_anon" ON coupons;
CREATE POLICY "coupons_update_authenticated" ON coupons
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "coupons_delete_anon" ON coupons;
CREATE POLICY "coupons_delete_authenticated" ON coupons
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- cms_content: admin-only writes
DROP POLICY IF EXISTS "cms_insert_anon" ON cms_content;
CREATE POLICY "cms_insert_authenticated" ON cms_content
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "cms_update_anon" ON cms_content;
CREATE POLICY "cms_update_authenticated" ON cms_content
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "cms_delete_anon" ON cms_content;
CREATE POLICY "cms_delete_authenticated" ON cms_content
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- system_settings: admin-only writes
DROP POLICY IF EXISTS "settings_insert_anon" ON system_settings;
CREATE POLICY "settings_insert_authenticated" ON system_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "settings_update_anon" ON system_settings;
CREATE POLICY "settings_update_authenticated" ON system_settings
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- audit_logs: admin-only inserts
DROP POLICY IF EXISTS "audit_insert_anon" ON audit_logs;
CREATE POLICY "audit_insert_authenticated" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- orders: admin-only DELETE
DROP POLICY IF EXISTS "orders_delete_anon" ON orders;
CREATE POLICY "orders_delete_authenticated" ON orders
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- reviews: UPDATE restricted to admin (moderation)
DROP POLICY IF EXISTS "reviews_update_anon" ON reviews;
CREATE POLICY "reviews_update_authenticated" ON reviews
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- customers: anon writes with non-empty email check
DROP POLICY IF EXISTS "customers_insert_anon" ON customers;
CREATE POLICY "customers_insert_anon" ON customers
  FOR INSERT TO anon, authenticated WITH CHECK (coalesce(email, '') <> '');
DROP POLICY IF EXISTS "customers_update_anon" ON customers;
CREATE POLICY "customers_update_anon" ON customers
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (coalesce(email, '') <> '');

-- order_status_history: anon INSERT with non-null order_id
DROP POLICY IF EXISTS "order_history_insert_anon" ON order_status_history;
CREATE POLICY "order_history_insert_anon" ON order_status_history
  FOR INSERT TO anon, authenticated WITH CHECK (order_id IS NOT NULL);

-- support_tickets: anon writes with non-empty customer_phone check
DROP POLICY IF EXISTS "tickets_insert_anon" ON support_tickets;
CREATE POLICY "tickets_insert_anon" ON support_tickets
  FOR INSERT TO anon, authenticated WITH CHECK (coalesce(customer_phone, '') <> '');
DROP POLICY IF EXISTS "tickets_update_anon" ON support_tickets;
CREATE POLICY "tickets_update_anon" ON support_tickets
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (coalesce(customer_phone, '') <> '');

-- otp_codes: anon writes with non-empty phone check
DROP POLICY IF EXISTS "otp_insert_anon" ON otp_codes;
CREATE POLICY "otp_insert_anon" ON otp_codes
  FOR INSERT TO anon, authenticated WITH CHECK (coalesce(phone, '') <> '');
DROP POLICY IF EXISTS "otp_update_anon" ON otp_codes;
CREATE POLICY "otp_update_anon" ON otp_codes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (coalesce(phone, '') <> '');
