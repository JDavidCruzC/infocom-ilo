CREATE TABLE public.expense_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  default_amount NUMERIC(12,2),
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_catalog TO authenticated;
GRANT ALL ON public.expense_catalog TO service_role;

ALTER TABLE public.expense_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view expense catalog" ON public.expense_catalog
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Staff can insert expense catalog" ON public.expense_catalog
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Staff can update expense catalog" ON public.expense_catalog
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Admins can delete expense catalog" ON public.expense_catalog
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_expense_catalog_updated_at
  BEFORE UPDATE ON public.expense_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed common items
INSERT INTO public.expense_catalog (category, name, sort_order) VALUES
  ('servicios','Recibo de Luz',1),
  ('servicios','Recibo de Agua',2),
  ('servicios','Internet',3),
  ('servicios','Teléfono / Celular',4),
  ('servicios','Cable / Streaming',5),
  ('limpieza','Lejía',1),
  ('limpieza','Cloro',2),
  ('limpieza','Ácido Muriático',3),
  ('limpieza','Poett / Ambientador',4),
  ('limpieza','Papel Higiénico',5),
  ('limpieza','Jabón / Detergente',6),
  ('limpieza','Escoba / Recogedor',7),
  ('limpieza','Bolsas de Basura',8),
  ('limpieza','Trapos / Franelas',9),
  ('combustible','Gasolina Auto',1),
  ('combustible','Pasajes Personal',2),
  ('combustible','Taxi / Delivery',3),
  ('combustible','Mantenimiento Vehículo',4),
  ('alquiler','Alquiler del Local',1),
  ('alquiler','Cochera / Estacionamiento',2),
  ('mantenimiento','Reparación Local',1),
  ('mantenimiento','Reparación Equipos',2),
  ('mantenimiento','Pintura / Acabados',3),
  ('oficina','Útiles de Oficina',1),
  ('oficina','Tinta / Toner',2),
  ('oficina','Papel Bond',3),
  ('oficina','Rollos Térmicos',4),
  ('marketing','Publicidad Redes',1),
  ('marketing','Volantes / Impresos',2),
  ('marketing','Banners / Diseño',3),
  ('alimentacion','Almuerzo Personal',1),
  ('alimentacion','Refrigerios',2),
  ('alimentacion','Agua / Bebidas',3),
  ('impuestos','SUNAT',1),
  ('impuestos','Municipalidad',2),
  ('impuestos','Trámites',3),
  ('otros','Gasto Varios',1);