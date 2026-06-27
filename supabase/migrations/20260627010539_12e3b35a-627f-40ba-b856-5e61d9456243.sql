CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado = 'emitido'
     AND (NEW.tipo_comprobante IS NULL OR btrim(COALESCE(NEW.tipo_comprobante, '')) = '') THEN
    NEW.tipo_comprobante := CASE
      WHEN NEW.tipo_general = 'servicio' THEN 'ticket_servicio'
      ELSE 'ticket_venta'
    END;
  END IF;

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

-- Repair already-created emitted transactions that were missing receipt metadata.
UPDATE public.transactions
SET tipo_comprobante = CASE
      WHEN tipo_general = 'servicio' THEN 'ticket_servicio'
      ELSE 'ticket_venta'
    END,
    numero_comprobante = ticket_number,
    updated_at = now()
WHERE estado = 'emitido'
  AND ticket_number IS NOT NULL
  AND (
    tipo_comprobante IS NULL
    OR btrim(COALESCE(tipo_comprobante, '')) = ''
    OR numero_comprobante IS NULL
    OR btrim(COALESCE(numero_comprobante, '')) = ''
    OR numero_comprobante ~ '^-+$'
  );