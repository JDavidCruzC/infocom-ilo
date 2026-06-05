
CREATE OR REPLACE FUNCTION public.terminal_mark_attendance(_staff_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tz text;
  v_local timestamp;
  v_today date;
  v_now time;
  v_staff record;
  v_existing record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'terminal') AND NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'moderator') THEN
    RAISE EXCEPTION 'No autorizado para marcar asistencia';
  END IF;

  SELECT COALESCE(value->>'timezone', 'America/Lima') INTO v_tz
  FROM public.store_settings WHERE key = 'business_hours';
  v_tz := COALESCE(v_tz, 'America/Lima');

  v_local := (now() AT TIME ZONE v_tz);
  v_today := v_local::date;
  v_now   := date_trunc('second', v_local)::time;

  SELECT id, full_name, is_active INTO v_staff
  FROM public.staff_members
  WHERE id = _staff_id
    AND is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = staff_members.user_id
        AND ur.role = 'terminal'
    );

  IF v_staff.id IS NULL THEN
    RAISE EXCEPTION 'Trabajador no disponible para marcado';
  END IF;

  SELECT * INTO v_existing FROM public.attendance_records
  WHERE staff_id = _staff_id AND date = v_today;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.attendance_records (staff_id, date, status, check_in_time, marked_by)
    VALUES (_staff_id, v_today, 'A', v_now, auth.uid())
    RETURNING * INTO v_existing;
    RETURN jsonb_build_object('action','check_in','time',to_char(v_now,'HH24:MI'),'staff_name',v_staff.full_name);
  END IF;

  IF v_existing.check_in_time IS NOT NULL AND v_existing.check_out_time IS NULL THEN
    UPDATE public.attendance_records SET check_out_time = v_now, marked_by = auth.uid()
    WHERE id = v_existing.id RETURNING * INTO v_existing;
    RETURN jsonb_build_object('action','check_out','time',to_char(v_now,'HH24:MI'),'staff_name',v_staff.full_name);
  END IF;

  RETURN jsonb_build_object('action','complete','time',to_char(v_existing.check_out_time,'HH24:MI'),'staff_name',v_staff.full_name);
END;
$function$;

-- Ensure default timezone in business_hours settings
UPDATE public.store_settings
SET value = jsonb_set(COALESCE(value,'{}'::jsonb), '{timezone}', '"America/Lima"', true)
WHERE key = 'business_hours'
  AND (value->>'timezone') IS NULL;
