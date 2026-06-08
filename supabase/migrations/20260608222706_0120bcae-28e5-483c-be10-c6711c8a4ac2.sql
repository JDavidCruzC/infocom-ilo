
-- Backfill legacy transactions: all existing ones were printed as "Ticket de Servicio"
UPDATE public.transactions
SET tipo_comprobante = 'ticket_servicio',
    numero_comprobante = COALESCE(numero_comprobante, ticket_number)
WHERE tipo_comprobante IS NULL;

-- Re-sync the ticket_servicio counter to the actual max emitted
DO $$
DECLARE
  max_num INTEGER;
  current_counters JSONB;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_comprobante, '\D', '', 'g'), '')::INTEGER), 0)
    INTO max_num
  FROM public.transactions
  WHERE tipo_comprobante = 'ticket_servicio';

  SELECT value INTO current_counters FROM public.store_settings WHERE key = 'comprobante_counters';
  IF current_counters IS NULL THEN
    current_counters := '{}'::jsonb;
  END IF;

  current_counters := jsonb_set(current_counters, '{ticket_servicio}', to_jsonb(GREATEST(max_num, (current_counters->>'ticket_servicio')::int)));

  INSERT INTO public.store_settings (key, value)
  VALUES ('comprobante_counters', current_counters)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END $$;
