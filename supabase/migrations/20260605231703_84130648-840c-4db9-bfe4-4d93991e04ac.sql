GRANT SELECT ON public.staff_members TO authenticated;
GRANT SELECT ON public.staff_schedules TO authenticated;
GRANT SELECT ON public.attendance_records TO authenticated;
GRANT INSERT, UPDATE ON public.attendance_records TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
GRANT ALL ON public.staff_schedules TO service_role;
GRANT ALL ON public.attendance_records TO service_role;

DROP POLICY IF EXISTS "Terminal can view active staff" ON public.staff_members;
CREATE POLICY "Terminal can view active staff"
ON public.staff_members
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'terminal') AND is_active = true);

DROP POLICY IF EXISTS "Terminal can view attendance board" ON public.attendance_records;
CREATE POLICY "Terminal can view attendance board"
ON public.attendance_records
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'terminal'));

CREATE OR REPLACE FUNCTION public.terminal_mark_attendance(_staff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_now time := CURRENT_TIME(0);
  v_staff record;
  v_existing record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'terminal') AND NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'moderator') THEN
    RAISE EXCEPTION 'No autorizado para marcar asistencia';
  END IF;

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

  SELECT * INTO v_existing
  FROM public.attendance_records
  WHERE staff_id = _staff_id AND date = v_today;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.attendance_records (staff_id, date, status, check_in_time, marked_by)
    VALUES (_staff_id, v_today, 'A', v_now, auth.uid())
    RETURNING * INTO v_existing;

    RETURN jsonb_build_object('action', 'check_in', 'time', to_char(v_now, 'HH24:MI'), 'staff_name', v_staff.full_name);
  END IF;

  IF v_existing.check_in_time IS NOT NULL AND v_existing.check_out_time IS NULL THEN
    UPDATE public.attendance_records
    SET check_out_time = v_now, marked_by = auth.uid()
    WHERE id = v_existing.id
    RETURNING * INTO v_existing;

    RETURN jsonb_build_object('action', 'check_out', 'time', to_char(v_now, 'HH24:MI'), 'staff_name', v_staff.full_name);
  END IF;

  RETURN jsonb_build_object('action', 'complete', 'time', to_char(v_existing.check_out_time, 'HH24:MI'), 'staff_name', v_staff.full_name);
END;
$$;

REVOKE ALL ON FUNCTION public.terminal_mark_attendance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terminal_mark_attendance(uuid) TO authenticated;