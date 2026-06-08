
CREATE OR REPLACE FUNCTION public.auto_mark_absences_today()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_tz text;
  v_local timestamp;
  v_today date;
  v_now time;
  v_dow int;
  v_staff record;
  v_latest_end time;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(value->>'timezone', 'America/Lima') INTO v_tz
  FROM public.store_settings WHERE key = 'business_hours';
  v_tz := COALESCE(v_tz, 'America/Lima');

  v_local := (now() AT TIME ZONE v_tz);
  v_today := v_local::date;
  v_now := date_trunc('minute', v_local)::time;
  v_dow := EXTRACT(DOW FROM v_local)::int;

  FOR v_staff IN
    SELECT sm.id
    FROM public.staff_members sm
    WHERE sm.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = sm.user_id AND ur.role = 'terminal'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance_records ar
        WHERE ar.staff_id = sm.id AND ar.date = v_today
      )
  LOOP
    SELECT MAX(end_time) INTO v_latest_end
    FROM public.staff_schedules
    WHERE staff_id = v_staff.id
      AND day_of_week = v_dow
      AND is_active = true;

    -- Only mark absent if the staff has a schedule today AND its latest end_time has passed
    IF v_latest_end IS NOT NULL AND v_now > v_latest_end THEN
      INSERT INTO public.attendance_records (staff_id, date, status)
      VALUES (v_staff.id, v_today, 'F')
      ON CONFLICT DO NOTHING;
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_mark_absences_today() TO authenticated;
