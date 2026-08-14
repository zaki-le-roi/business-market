/*
# Create Marketing Tables and RLS Policies

## Tables
1. `marketing_promotions`: Store promotional campaigns, flash sales, bundle deals.
2. `marketing_notifications`: Store marketing push/in-app notifications sent or scheduled for customers.

## Coupon Column Additions
- Adds `per_customer_limit` and `customer_group_restriction` to `coupons` if not already present.
*/

-- 1. Ensure coupons table has per_customer_limit and customer_group_restriction
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_customer_limit INT DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS customer_group_restriction VARCHAR(50) DEFAULT 'all';

-- 2. Create marketing_promotions table
CREATE TABLE IF NOT EXISTS marketing_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_ar TEXT NOT NULL,
    title_fr TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('flash_sale', 'product_discount', 'category_discount', 'buy_x_get_y', 'bundle', 'scheduled')),
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
    discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    target_type TEXT NOT NULL DEFAULT 'all_products' CHECK (target_type IN ('all_products', 'specific_products', 'specific_categories')),
    product_ids TEXT[] DEFAULT '{}',
    category_ids TEXT[] DEFAULT '{}',
    buy_x INT DEFAULT 0,
    get_y INT DEFAULT 0,
    bundle_price NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for marketing_promotions
ALTER TABLE marketing_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promotions_select_all" ON marketing_promotions;
CREATE POLICY "promotions_select_all" ON marketing_promotions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "promotions_insert_authenticated" ON marketing_promotions;
CREATE POLICY "promotions_insert_authenticated" ON marketing_promotions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "promotions_update_authenticated" ON marketing_promotions;
CREATE POLICY "promotions_update_authenticated" ON marketing_promotions
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "promotions_delete_authenticated" ON marketing_promotions;
CREATE POLICY "promotions_delete_authenticated" ON marketing_promotions
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);


-- 3. Create marketing_notifications table
CREATE TABLE IF NOT EXISTS marketing_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_group TEXT NOT NULL DEFAULT 'all' CHECK (target_group IN ('all', 'retail', 'wholesale', 'selected')),
    selected_customer_ids TEXT[] DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for marketing_notifications
ALTER TABLE marketing_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_authenticated" ON marketing_notifications;
CREATE POLICY "notifications_select_authenticated" ON marketing_notifications
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_insert_authenticated" ON marketing_notifications;
CREATE POLICY "notifications_insert_authenticated" ON marketing_notifications
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update_authenticated" ON marketing_notifications;
CREATE POLICY "notifications_update_authenticated" ON marketing_notifications
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_delete_authenticated" ON marketing_notifications;
CREATE POLICY "notifications_delete_authenticated" ON marketing_notifications
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
