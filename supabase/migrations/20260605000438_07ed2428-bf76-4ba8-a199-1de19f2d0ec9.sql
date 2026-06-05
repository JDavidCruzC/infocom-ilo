-- Storage policies for staff-documents bucket
CREATE POLICY "staff_docs admin all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'staff-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'staff-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "staff_docs moderators read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'staff-documents' AND public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "staff_docs own read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'staff-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.staff_members WHERE user_id = auth.uid()
    )
  );