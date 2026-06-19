
-- Cotizaciones (Quotes) module
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  cliente_nombre TEXT,
  cliente_documento TEXT,
  cliente_telefono TEXT,
  cliente_email TEXT,
  cliente_direccion TEXT,
  notas TEXT,
  condiciones TEXT,
  descuento_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  incluye_igv BOOLEAN NOT NULL DEFAULT true,
  igv_pct NUMERIC(5,2) NOT NULL DEFAULT 18,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento_monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  igv_monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'borrador',
  creado_por TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID,
  descripcion TEXT NOT NULL,
  imagen_url TEXT,
  cantidad NUMERIC(12,2) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quotes accessible to staff" ON public.quotes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_module_access(auth.uid(), 'pos')
    OR public.has_module_access(auth.uid(), 'cotizaciones')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_module_access(auth.uid(), 'pos')
    OR public.has_module_access(auth.uid(), 'cotizaciones')
  );

CREATE POLICY "Quote items accessible to staff" ON public.quote_items
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_module_access(auth.uid(), 'pos')
    OR public.has_module_access(auth.uid(), 'cotizaciones')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_module_access(auth.uid(), 'pos')
    OR public.has_module_access(auth.uid(), 'cotizaciones')
  );

-- Auto quote number COT-YYYYMMDD-NNNN
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := 'COT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_quote_number ON public.quotes;
CREATE TRIGGER trg_generate_quote_number
BEFORE INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.generate_quote_number();

DROP TRIGGER IF EXISTS trg_update_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Register cotizaciones module so permissions UI can toggle it
INSERT INTO public.role_permissions (role, module, can_access)
SELECT 'admin'::app_role, 'cotizaciones', true
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'admin'::app_role AND module = 'cotizaciones');

INSERT INTO public.role_permissions (role, module, can_access)
SELECT 'moderator'::app_role, 'cotizaciones', true
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'moderator'::app_role AND module = 'cotizaciones');
