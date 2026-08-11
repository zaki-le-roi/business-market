-- Fix RLS policies for products table - allow anon (admin panel) to INSERT/UPDATE/DELETE
CREATE POLICY "products_insert_all" ON products
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "products_update_all" ON products
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "products_delete_all" ON products
  FOR DELETE TO anon, authenticated
  USING (true);

-- Fix RLS policies for categories table - allow anon (admin panel) to INSERT/UPDATE/DELETE
CREATE POLICY "categories_insert_all" ON categories
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "categories_update_all" ON categories
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "categories_delete_all" ON categories
  FOR DELETE TO anon, authenticated
  USING (true);