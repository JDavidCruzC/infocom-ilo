CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If the app already allocated a comprobante number, use the same value as the ticket number
  -- so printing/history never shows a different or lower correlative.
  IF (NEW.ticket_number IS NULL OR btrim(NEW.ticket_number) = '')
     AND NEW.numero_comprobante IS NOT NULL
     AND btrim(NEW.numero_comprobante) <> ''
     AND NEW.numero_comprobante !~ '^-+$' THEN
    NEW.ticket_number := NEW.numero_comprobante;
  END IF;

  IF NEW.ticket_number IS NULL OR btrim(NEW.ticket_number) = '' THEN
    NEW.ticket_number := LPAD(nextval('public.ticket_number_seq')::text, 6, '0');
  END IF;

  -- Safety net: every emitted receipt must have a visible receipt number.
  IF NEW.estado = 'emitido'
     AND NEW.tipo_comprobante IS NOT NULL
     AND btrim(COALESCE(NEW.tipo_comprobante, '')) <> ''
     AND (
       NEW.numero_comprobante IS NULL
       OR btrim(NEW.numero_comprobante) = ''
       OR NEW.numero_comprobante ~ '^-+$'
     ) THEN
    NEW.numero_comprobante := NEW.ticket_number;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_comprobante_number(_kind text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key text := 'comprobante_counters';
  v_clean text := lower(regexp_replace(_kind, '[^a-z0-9_]', '_', 'g'));
  v_next int;
BEGIN
  IF v_clean IS NULL OR length(v_clean) = 0 THEN
    RAISE EXCEPTION 'Kind requerido';
  END IF;

  -- Use the same real store-wide sequence as the POS ticket number.
  -- This avoids ticket_venta starting again at 000001 while the store ticket is already 000128+.
  v_next := nextval('public.ticket_number_seq')::int;

  INSERT INTO public.store_settings(key, value)
  VALUES (v_key, jsonb_build_object(v_clean, v_next))
  ON CONFLICT (key) DO UPDATE
    SET value = jsonb_set(
                  COALESCE(public.store_settings.value, '{}'::jsonb),
                  ARRAY[v_clean],
                  to_jsonb(v_next),
                  true
                ),
        updated_at = now();

  RETURN LPAD(v_next::text, 6, '0');
END;
$function$;

-- Normalize existing emitted receipts to the real POS/store ticket correlative.
UPDATE public.transactions
SET numero_comprobante = ticket_number,
    updated_at = now()
WHERE estado = 'emitido'
  AND ticket_number IS NOT NULL
  AND tipo_comprobante IS NOT NULL
  AND btrim(COALESCE(tipo_comprobante, '')) <> ''
  AND numero_comprobante IS DISTINCT FROM ticket_number;

-- Sync visible counters to the latest real ticket sequence so settings/debug views do not show old lower values.
INSERT INTO public.store_settings(key, value)
VALUES ('comprobante_counters', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

WITH seq AS (
  SELECT last_value::int AS n FROM public.ticket_number_seq
)
UPDATE public.store_settings ss
SET value = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(COALESCE(ss.value, '{}'::jsonb), '{ticket_venta}', to_jsonb(GREATEST(COALESCE((ss.value->>'ticket_venta')::int, 0), (SELECT n FROM seq))), true),
                  '{ticket_servicio}', to_jsonb(GREATEST(COALESCE((ss.value->>'ticket_servicio')::int, 0), (SELECT n FROM seq))), true
                ),
                '{boleta}', to_jsonb(GREATEST(COALESCE((ss.value->>'boleta')::int, 0), (SELECT n FROM seq))), true
              ),
              '{factura}', to_jsonb(GREATEST(COALESCE((ss.value->>'factura')::int, 0), (SELECT n FROM seq))), true
            ),
    updated_at = now()
WHERE ss.key = 'comprobante_counters';