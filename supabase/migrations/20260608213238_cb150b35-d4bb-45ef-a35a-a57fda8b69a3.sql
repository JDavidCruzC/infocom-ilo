-- Seed comprobante counters with current real values so numbering continues correctly
UPDATE public.store_settings
SET value = jsonb_build_object(
  'ticket_servicio', GREATEST(COALESCE((value->>'ticket_servicio')::int, 0), 113),
  'ticket_venta',    COALESCE((value->>'ticket_venta')::int, 0),
  'boleta',          COALESCE((value->>'boleta')::int, 0),
  'factura',         COALESCE((value->>'factura')::int, 0),
  'proforma',        COALESCE((value->>'proforma')::int, 0),
  'cotizacion',      COALESCE((value->>'cotizacion')::int, 0),
  'nota_venta',      COALESCE((value->>'nota_venta')::int, 0),
  'ticket_interno',  COALESCE((value->>'ticket_interno')::int, 0)
),
updated_at = now()
WHERE key = 'comprobante_counters';

-- Insert in case it doesn't exist
INSERT INTO public.store_settings(key, value)
SELECT 'comprobante_counters', jsonb_build_object('ticket_servicio', 113)
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings WHERE key = 'comprobante_counters');

-- Allow admins to adjust counters manually via RPC
CREATE OR REPLACE FUNCTION public.admin_set_comprobante_counter(_kind text, _value int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := lower(regexp_replace(_kind, '[^a-z0-9_]', '_', 'g'));
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Solo administradores';
  END IF;
  IF _value < 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;

  INSERT INTO public.store_settings(key, value)
  VALUES ('comprobante_counters', jsonb_build_object(v_clean, _value))
  ON CONFLICT (key) DO UPDATE
    SET value = jsonb_set(COALESCE(public.store_settings.value,'{}'::jsonb), ARRAY[v_clean], to_jsonb(_value), true),
        updated_at = now();
END;
$$;