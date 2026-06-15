
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins and moderators manage products" ON public.products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "Admins manage brands" ON public.brands;
CREATE POLICY "Admins and moderators manage brands" ON public.brands
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "Admin can upload brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete brand logos" ON storage.objects;
CREATE POLICY "Staff can upload brand logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id='brand-logos' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator')));
CREATE POLICY "Staff can update brand logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id='brand-logos' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator')));
CREATE POLICY "Staff can delete brand logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id='brand-logos' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator')));
