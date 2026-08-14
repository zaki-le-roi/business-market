/*
# Auto-approve reviews by default

## Summary
Changes the default value of `reviews.is_approved` from `false` to `true` so
that new reviews appear immediately without requiring admin approval. The
admin can still un-approve a review later if needed.

## Changes
- `reviews.is_approved` default changed to `true`.

## Security
- No RLS policy changes. The SELECT policy `reviews_read_approved` shows
  approved reviews to everyone; un-approving a review hides it.
*/
ALTER TABLE reviews ALTER COLUMN is_approved SET DEFAULT true;
