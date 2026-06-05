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
    IF (EXTRACT(DOW FROM v_day)::int = ANY (v_work_days)) THEN
      FOR v_staff IN
        SELECT sm.id
        FROM public.staff_members sm
        WHERE sm.is_active = true
          AND NOT EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = sm.user_id
              AND ur.role = 'terminal'
          )
      LOOP
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