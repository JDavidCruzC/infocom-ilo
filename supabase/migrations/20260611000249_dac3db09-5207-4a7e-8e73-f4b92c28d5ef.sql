
CREATE TABLE public.receipt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  content_html text NOT NULL DEFAULT '',
  content_json jsonb,
  paper_size text NOT NULL DEFAULT 'ticket_80mm',
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_templates TO authenticated;
GRANT ALL ON public.receipt_templates TO service_role;

ALTER TABLE public.receipt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view templates" ON public.receipt_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/mod can insert templates" ON public.receipt_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Admin/mod can update templates" ON public.receipt_templates
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Admin can delete templates" ON public.receipt_templates
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER receipt_templates_updated_at
  BEFORE UPDATE ON public.receipt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_receipt_templates_kind ON public.receipt_templates(kind);
