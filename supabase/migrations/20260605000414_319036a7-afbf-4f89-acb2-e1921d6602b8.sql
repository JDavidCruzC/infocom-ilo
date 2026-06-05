-- 1. Añadir 'terminal' al enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'terminal';

-- 2. Añadir columna address a staff_members
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS address text;

-- 3. Crear tabla staff_documents
CREATE TABLE IF NOT EXISTS public.staff_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  file_type text,
  size_bytes integer,
  description text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_documents TO authenticated;
GRANT ALL ON public.staff_documents TO service_role;

ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff documents"
  ON public.staff_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators view staff documents"
  ON public.staff_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff view own documents"
  ON public.staff_documents FOR SELECT TO authenticated
  USING (staff_id IN (SELECT id FROM public.staff_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff_id ON public.staff_documents(staff_id);