-- Add admin SELECT policies for products and categories (no is_active filter)
-- This allows admin panel to see all products including inactive ones

CREATE POLICY "products_select_all" ON products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "categories_select_all" ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Also add for orders since admin needs to see all orders
CREATE POLICY "orders_select_all" ON orders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "orders_delete_all" ON orders FOR DELETE
  TO anon, authenticated
  USING (true);

-- Add policies for coupons
CREATE POLICY "coupons_select_all" ON coupons FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "coupons_insert_all" ON coupons FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "coupons_update_all" ON coupons FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "coupons_delete_all" ON coupons FOR DELETE
  TO anon, authenticated
  USING (true);

-- Add policies for support_tickets
CREATE POLICY "tickets_select_all" ON support_tickets FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "tickets_insert_all" ON support_tickets FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "tickets_update_all" ON support_tickets FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Add policies for cms_content
CREATE POLICY "cms_select_all" ON cms_content FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "cms_insert_all" ON cms_content FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "cms_update_all" ON cms_content FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "cms_delete_all" ON cms_content FOR DELETE
  TO anon, authenticated
  USING (true);

-- Add policies for audit_logs
CREATE POLICY "audit_select_all" ON audit_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "audit_insert_all" ON audit_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);