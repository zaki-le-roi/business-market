-- Enable full management policies for the wilayas table so admins can add, update, and delete them.
DROP POLICY IF EXISTS "wilayas_insert_policy" ON wilayas;
CREATE POLICY "wilayas_insert_policy" ON wilayas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "wilayas_update_policy" ON wilayas;
CREATE POLICY "wilayas_update_policy" ON wilayas FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wilayas_delete_policy" ON wilayas;
CREATE POLICY "wilayas_delete_policy" ON wilayas FOR DELETE USING (true);
