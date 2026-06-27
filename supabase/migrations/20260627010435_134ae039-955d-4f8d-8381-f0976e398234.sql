CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.ticket_number IS NULL OR btrim(NEW.ticket_number) = '' THEN
    NEW.ticket_number := LPAD(nextval('public.ticket_number_seq')::text, 6, '0');
  END IF;

  -- Safety net: every emitted sale/service receipt must have a visible receipt number.
  -- The ticket_number sequence is the real store-wide correlative used in POS/history.
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

-- Fix already-created emitted POS/accounting receipts that still show blank/dashes.
UPDATE public.transactions
SET numero_comprobante = ticket_number,
    updated_at = now()
WHERE estado = 'emitido'
  AND ticket_number IS NOT NULL
  AND tipo_comprobante IS NOT NULL
  AND btrim(COALESCE(tipo_comprobante, '')) <> ''
  AND (
    numero_comprobante IS NULL
    OR btrim(numero_comprobante) = ''
    OR numero_comprobante ~ '^-+$'
  );

-- The user specifically reported lower POS sale receipt numbers; align ticket-sale receipts
-- to the store-wide ticket correlative so POS history/printing shows the expected number.
UPDATE public.transactions
SET numero_comprobante = ticket_number,
    updated_at = now()
WHERE estado = 'emitido'
  AND tipo_comprobante = 'ticket_venta'
  AND ticket_number IS NOT NULL
  AND numero_comprobante IS DISTINCT FROM ticket_number;

-- Keep the old JSON counters from ever going backwards if another screen still asks for them.
INSERT INTO public.store_settings(key, value)
VALUES ('comprobante_counters', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

WITH maxes AS (
  SELECT
    COALESCE(MAX(NULLIF(regexp_replace(COALESCE(ticket_number, ''), '[^0-9]', '', 'g'), '')::int), 0) AS max_ticket,
    COALESCE(MAX(NULLIF(regexp_replace(COALESCE(numero_comprobante, ''), '[^0-9]', '', 'g'), '')::int), 0) AS max_num
  FROM public.transactions
), target AS (
  SELECT GREATEST(max_ticket, max_num, 0) AS n FROM maxes
)
UPDATE public.store_settings ss
SET value = jsonb_set(
              jsonb_set(
                jsonb_set(COALESCE(ss.value, '{}'::jsonb), '{ticket_venta}', to_jsonb(GREATEST(COALESCE((ss.value->>'ticket_venta')::int, 0), (SELECT n FROM target))), true),
                '{boleta}', to_jsonb(GREATEST(COALESCE((ss.value->>'boleta')::int, 0), (SELECT n FROM target))), true
              ),
              '{factura}', to_jsonb(GREATEST(COALESCE((ss.value->>'factura')::int, 0), (SELECT n FROM target))), true
            ),
    updated_at = now()
WHERE ss.key = 'comprobante_counters';