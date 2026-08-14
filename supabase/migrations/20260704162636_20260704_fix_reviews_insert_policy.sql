/*
# Fix reviews INSERT policy

Tightens the reviews INSERT policy to require a non-empty product_id and
customer identifier, preventing empty/spam review inserts by anon.
*/

DROP POLICY IF EXISTS "reviews_insert_anon" ON reviews;
CREATE POLICY "reviews_insert_anon" ON reviews
  FOR INSERT TO anon, authenticated
  WITH CHECK (product_id IS NOT NULL AND coalesce(customer_name, '') <> '');
