
-- 1) Reset permisos del rol terminal: solo pos + asistencias
UPDATE public.role_permissions
SET can_access = false, updated_at = now()
WHERE role = 'terminal' AND module NOT IN ('pos','asistencias');

UPDATE public.role_permissions
SET can_access = true, updated_at = now()
WHERE role = 'terminal' AND module IN ('pos','asistencias');

-- 2) Tabla de metadata de roles (sistema + custom)
CREATE TABLE IF NOT EXISTS public.role_metadata (
  role_key text PRIMARY KEY,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'Shield',
  color text NOT NULL DEFAULT 'text-primary',
  description text,
  is_system boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_metadata TO authenticated, anon;
GRANT ALL ON public.role_metadata TO service_role;

ALTER TABLE public.role_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_metadata_read_all" ON public.role_metadata;
CREATE POLICY "role_metadata_read_all" ON public.role_metadata FOR SELECT USING (true);

DROP POLICY IF EXISTS "role_metadata_admin_write" ON public.role_metadata;
CREATE POLICY "role_metadata_admin_write" ON public.role_metadata
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_role_metadata_updated_at
  BEFORE UPDATE ON public.role_metadata
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed system roles
INSERT INTO public.role_metadata (role_key, label, icon, color, description, is_system, sort_order) VALUES
  ('admin','Administrador','Crown','text-destructive','Acceso total al sistema',true,1),
  ('moderator','Moderador / Personal','Shield','text-warning','Acceso configurable por módulo',true,2),
  ('terminal','Terminal Tienda','Monitor','text-accent','Cuenta para terminales físicas: ventas y marcado de asistencia. No puede editar manualmente la cuadrícula.',true,3),
  ('user','Usuario / Practicante','UserCheck','text-primary','Acceso limitado, ideal para practicantes',true,4)
ON CONFLICT (role_key) DO NOTHING;

-- 3) Función para crear nuevos roles dinámicamente (extiende el enum app_role)
CREATE OR REPLACE FUNCTION public.admin_create_role(
  _key text, _label text, _icon text DEFAULT 'Shield',
  _color text DEFAULT 'text-primary', _description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := lower(regexp_replace(_key, '[^a-z0-9_]', '_', 'g'));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden crear roles';
  END IF;

  IF v_key IS NULL OR length(v_key) < 2 THEN
    RAISE EXCEPTION 'Clave de rol inválida';
  END IF;

  -- Add enum value if missing (no podrá usarse en la MISMA transacción)
  EXECUTE format('ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS %L', v_key);

  -- Metadata
  INSERT INTO public.role_metadata (role_key, label, icon, color, description, is_system, sort_order)
  VALUES (v_key, _label, COALESCE(_icon,'Shield'), COALESCE(_color,'text-primary'), _description, false, 200)
  ON CONFLICT (role_key) DO UPDATE
    SET label = EXCLUDED.label, icon = EXCLUDED.icon, color = EXCLUDED.color, description = EXCLUDED.description;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_role(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_role(text,text,text,text,text) TO authenticated;

-- 4) Función para marcar faltas pendientes del mes (días laborales pasados sin registro)
CREATE OR REPLACE FUNCTION public.admin_mark_pending_absences(_year int, _month int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_work_days int[] := ARRAY[1,2,3,4,5,6];
  v_settings jsonb;
  v_start date := make_date(_year, _month, 1);
  v_end date := LEAST(CURRENT_DATE - INTERVAL '1 day', (v_start + INTERVAL '1 month - 1 day')::date);
  v_day date;
  v_staff record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Solo administradores';
  END IF;

  SELECT value INTO v_settings FROM public.store_settings WHERE key='business_hours';
  IF v_settings ? 'work_days' THEN
    SELECT array_agg((d)::int) INTO v_work_days
    FROM jsonb_array_elements_text(v_settings->'work_days') d;
  END IF;

  v_day := v_start;
  WHILE v_day <= v_end LOOP
    -- Postgres dow: 0=Sun..6=Sat (igual que JS)
    IF (EXTRACT(DOW FROM v_day)::int = ANY (v_work_days)) THEN
      FOR v_staff IN SELECT id FROM public.staff_members WHERE is_active = true LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.attendance_records
          WHERE staff_id = v_staff.id AND date = v_day
        ) THEN
          INSERT INTO public.attendance_records (staff_id, date, status)
          VALUES (v_staff.id, v_day, 'F');
          v_inserted := v_inserted + 1;
        END IF;
      END LOOP;
    END IF;
    v_day := v_day + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_pending_absences(int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_pending_absences(int,int) TO authenticated;

-- 5) Asegurar tolerance_minutes en business_hours (default 5)
UPDATE public.store_settings
SET value = jsonb_set(COALESCE(value,'{}'::jsonb), '{tolerance_minutes}', '5'::jsonb, true)
WHERE key='business_hours'
  AND (value->>'tolerance_minutes') IS NULL;
