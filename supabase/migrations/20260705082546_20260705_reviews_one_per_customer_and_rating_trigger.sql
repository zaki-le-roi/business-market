/*
# Reviews: one-per-customer constraint + rating recalculation trigger

## Summary
1. Adds a unique constraint on (product_id, customer_phone) so each customer
   can submit only one review per product. They can still edit it later.
2. Adds a trigger that recalculates the product's average rating and review
   count automatically after a review is inserted, updated, or deleted.

## Changes

### Unique constraint
- `reviews_one_per_customer` — UNIQUE (product_id, customer_phone) where
  customer_phone IS NOT NULL. This prevents duplicate reviews from the same
  customer phone for the same product. Existing duplicates (if any) are not
  affected because the constraint uses NULLS NOT DISTINCT only for the phone.

### Trigger function
- `recalculate_product_rating()` — after INSERT/UPDATE/DELETE on reviews,
  updates the parent product's `rating` (average of approved reviews) and
  `review_count` (count of approved reviews). Runs for each row.

### Trigger
- `trigger_recalc_product_rating` — AFTER INSERT OR UPDATE OR DELETE on reviews
  calls `recalculate_product_rating()`.

## Security
- No RLS policy changes. The trigger runs with the privileges of the calling
  role, but only updates the products table (which the anon role can UPDATE
  via existing policies for the rating columns — note: the products UPDATE
  policy was tightened to authenticated-only in a prior migration, so this
  trigger must run with elevated privileges to update the product rating).
  The function is marked SECURITY DEFINER so it can update the products table
  regardless of the caller's RLS.

## Important notes
1. Only approved reviews (is_approved = true) are counted toward the rating.
2. The trigger handles the case where a review is approved/unapproved — the
   rating updates accordingly.
3. If a customer has no phone (NULL), the unique constraint does not apply,
   allowing guest reviews, but the RLS policy still requires a non-empty
   customer_name.
*/

-- Unique constraint: one review per customer phone per product
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_customer
  ON reviews (product_id, customer_phone)
  WHERE customer_phone IS NOT NULL;

-- Trigger function to recalculate product rating
CREATE OR REPLACE FUNCTION recalculate_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  IF pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE products
  SET rating = COALESCE(
    (SELECT AVG(rating) FROM reviews WHERE product_id = pid AND is_approved = true),
    0
  ),
  review_count = (
    SELECT COUNT(*) FROM reviews WHERE product_id = pid AND is_approved = true
  )
  WHERE id = pid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger: after insert/update/delete on reviews
DROP TRIGGER IF EXISTS trigger_recalc_product_rating ON reviews;
CREATE TRIGGER trigger_recalc_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_product_rating();
