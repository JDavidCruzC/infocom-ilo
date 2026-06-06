
-- Add document kind + sequential number per kind to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tipo_comprobante TEXT,
  ADD COLUMN IF NOT EXISTS numero_comprobante TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_tipo_comprobante ON public.transactions (tipo_comprobante);
CREATE INDEX IF NOT EXISTS idx_transactions_numero_comprobante ON public.transactions (numero_comprobante);

-- Atomic sequential generator per document kind, stored in store_settings under key "comprobante_counters"
CREATE OR REPLACE FUNCTION public.next_comprobante_number(_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := 'comprobante_counters';
  v_clean text := lower(regexp_replace(_kind, '[^a-z0-9_]', '_', 'g'));
  v_current jsonb;
  v_next int;
BEGIN
  IF v_clean IS NULL OR length(v_clean) = 0 THEN
    RAISE EXCEPTION 'Kind requerido';
  END IF;

  -- Ensure row exists
  INSERT INTO public.store_settings(key, value)
  VALUES (v_key, '{}'::jsonb)
  ON CONFLICT (key) DO NOTHING;

  -- Atomic increment using UPDATE...RETURNING with row lock
  UPDATE public.store_settings
     SET value = jsonb_set(
                   COALESCE(value, '{}'::jsonb),
                   ARRAY[v_clean],
                   to_jsonb(COALESCE((value->>v_clean)::int, 0) + 1),
                   true
                 ),
         updated_at = now()
   WHERE key = v_key
   RETURNING value INTO v_current;

  v_next := (v_current->>v_clean)::int;
  RETURN LPAD(v_next::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_comprobante_number(text) TO authenticated;
