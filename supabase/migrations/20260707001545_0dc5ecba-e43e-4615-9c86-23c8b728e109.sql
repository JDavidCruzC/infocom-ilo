
-- Respect staff employment period (start_date/end_date) in absence auto-marking.

CREATE OR REPLACE FUNCTION public.auto_mark_absences_today()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted int := 0;
  v_tz text;
  v_local timestamp;
  v_today date;
  v_now time;
  v_staff record;
  v_target_date date;
  v_dow int;
  v_latest_end time;
  v_grace_passed boolean;
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

  FOR v_target_date IN SELECT generate_series((v_today - INTERVAL '1 day')::date, v_today, INTERVAL '1 day')::date LOOP
    v_dow := EXTRACT(DOW FROM v_target_date)::int;
    FOR v_staff IN
      SELECT sm.id, sm.start_date, sm.end_date
      FROM public.staff_members sm
      WHERE sm.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = sm.user_id AND ur.role = 'terminal'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.attendance_records ar
          WHERE ar.staff_id = sm.id AND ar.date = v_target_date
        )
    LOOP
      -- Skip dates outside employment period
      IF v_staff.start_date IS NOT NULL AND v_target_date < v_staff.start_date THEN CONTINUE; END IF;
      IF v_staff.end_date IS NOT NULL AND v_target_date > v_staff.end_date THEN CONTINUE; END IF;

      SELECT MAX(end_time) INTO v_latest_end
      FROM public.staff_schedules
      WHERE staff_id = v_staff.id
        AND day_of_week = v_dow
        AND is_active = true;

      IF v_latest_end IS NULL THEN CONTINUE; END IF;

      v_grace_passed := (v_local >= (v_target_date::timestamp + v_latest_end + INTERVAL '24 hours'));

      IF v_grace_passed THEN
        INSERT INTO public.attendance_records (staff_id, date, status)
        VALUES (v_staff.id, v_target_date, 'F')
        ON CONFLICT DO NOTHING;
        v_inserted := v_inserted + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END;
$function$;


CREATE OR REPLACE FUNCTION public.admin_mark_pending_absences(_year integer, _month integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF (EXTRACT(DOW FROM v_day)::int = ANY (v_work_days)) THEN
      FOR v_staff IN
        SELECT sm.id, sm.start_date, sm.end_date
        FROM public.staff_members sm
        WHERE sm.is_active = true
          AND NOT EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = sm.user_id AND ur.role = 'terminal'
          )
      LOOP
        -- Only mark absences within the employment window
        IF v_staff.start_date IS NOT NULL AND v_day < v_staff.start_date THEN CONTINUE; END IF;
        IF v_staff.end_date IS NOT NULL AND v_day > v_staff.end_date THEN CONTINUE; END IF;

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
$function$;


-- Clean up already-inserted phantom absences that fall outside a staff member's employment period.
-- Only remove auto-marked ones (no manual check-in/out and status = 'F').
DELETE FROM public.attendance_records ar
USING public.staff_members sm
WHERE ar.staff_id = sm.id
  AND ar.status = 'F'
  AND ar.check_in_time IS NULL
  AND ar.check_out_time IS NULL
  AND (ar.extra_punches IS NULL OR ar.extra_punches = '[]'::jsonb)
  AND (
        (sm.start_date IS NOT NULL AND ar.date < sm.start_date)
     OR (sm.end_date IS NOT NULL AND ar.date > sm.end_date)
  );
