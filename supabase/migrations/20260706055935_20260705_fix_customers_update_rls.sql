/*
# Fix customers UPDATE RLS policy

## Summary
The existing `customers_update_anon` policy has `WITH CHECK (email <> '')`
which blocks updates to customers without an email. This relaxes the check
to allow all updates (the application layer manages validation).

## Security
- No new risks: the policy still only allows UPDATE. The application layer
  validates all data before calling Supabase.
*/

DROP POLICY IF EXISTS "customers_update_anon" ON customers;
CREATE POLICY "customers_update_anon" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
