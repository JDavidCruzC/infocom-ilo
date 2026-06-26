
DROP POLICY IF EXISTS "Auth read shared receipts" ON storage.objects;
CREATE POLICY "Auth read shared receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'shared-receipts');

DROP POLICY IF EXISTS "Auth upload shared receipts" ON storage.objects;
CREATE POLICY "Auth upload shared receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shared-receipts');

DROP POLICY IF EXISTS "Auth update shared receipts" ON storage.objects;
CREATE POLICY "Auth update shared receipts" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'shared-receipts');
