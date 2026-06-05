import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Clock, UserCheck, Filter, AlertTriangle, UserPlus, Sun, Moon, Settings2, Save, Loader2, FileSpreadsheet, FileText, User } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import XLSX from "xlsx-js-style";
import { generateMonthlyAttendancePdf } from "@/features/admin/utils/attendancePdf";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const STATUS_LABELS: Record<string,{ label: string; color: string; full: string }> = {
  A: { label: "A", color: "bg-green-500/20 text-green-400", full: "Asistencia" },
  F: { label: "F", color: "bg-red-500/20 text-red-400", full: "Falta" },
  T: { label: "T", color: "bg-yellow-500/20 text-yellow-400", full: "Tardanza" },
  J: { label: "J", color: "bg-blue-500/20 text-blue-400", full: "Justificada" },
  D: { label: "D", color: "bg-gray-500/20 text-gray-400", full: "Descanso" },
};

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const DAY_NAMES_SHORT = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

interface BusinessHours {
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
  work_days: number[];
  tolerance_minutes: number;
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  morning_start: "09:00",
  morning_end: "13:00",
  afternoon_start: "15:00",
  afternoon_end: "20:00",
  work_days: [1, 2, 3, 4, 5, 6],
  tolerance_minutes: 5,
};


const AttendancePage = () => {
  const qc = useQueryClient();
  const { isAdmin, user, roles } = useAuth();
  const isTerminal = roles.includes("terminal" as any);
  // Asistente puede marcar por otros (igual que admin); user/practicante/terminal solo lo suyo
  const canMarkOthers = isAdmin || roles.includes("moderator" as any) || roles.includes("asistente" as any);
  const canUseControlView = canMarkOthers || isTerminal;
  const canEditAttendanceGrid = isAdmin;
  const [pdfStaffId, setPdfStaffId] = useState<string>("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [filterStaff, setFilterStaff] = useState("all");
  const [activeTab, setActiveTab] = useState("grid");
  const [editHours, setEditHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);
  const [savingHours, setSavingHours] = useState(false);
  const autoAdminMarkKeyRef = useRef<string | null>(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: staff = [] } = useQuery({
    queryKey: ["staff_members_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("*").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: terminalUserIds = [] } = useQuery({
    queryKey: ["terminal_user_ids"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", "terminal" as any);
      return (data || []).map((r: any) => r.user_id).filter(Boolean);
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["attendance_records", month, year],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_records").select("*")
        .gte("date", startDate).lte("date", endDate);
      if (error) throw error;
      return data;
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["staff_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_schedules").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Load business hours from store_settings
  const { data: businessHours } = useQuery({
    queryKey: ["store_settings", "business_hours"],
    queryFn: async () => {
      const { data } = await supabase.from("store_settings").select("value").eq("key", "business_hours").maybeSingle();
      return data?.value as any || {
        morning_start: "09:00", morning_end: "13:00",
        afternoon_start: "15:00", afternoon_end: "20:00",
        work_days: [1, 2, 3, 4, 5, 6], // Mon-Sat by default
      };
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (businessHours) setEditHours(businessHours);
  }, [businessHours]);

  const scheduleMap = useMemo(() => {
    const m: Record<string, any[]> = {};
    schedules.forEach((s: any) => {
      if (!m[s.staff_id]) m[s.staff_id] = [];
      m[s.staff_id].push(s);
    });
    return m;
  }, [schedules]);

  const getScheduleForDay = (staffId: string, dayOfWeek: number) => {
    return (scheduleMap[staffId] || []).filter((s: any) => s.day_of_week === dayOfWeek);
  };

  /** Check if a staff member has a rest day on a given day of the week */
  const isRestDay = (staffId: string, dayOfWeek: number): boolean => {
    const staffScheds = scheduleMap[staffId] || [];
    // If staff has schedules assigned, check if that day is included
    if (staffScheds.length > 0) {
      return !staffScheds.some((s: any) => s.day_of_week === dayOfWeek);
    }
    // If no schedules assigned, fall back to business hours work_days
    const workDays = businessHours?.work_days || [1, 2, 3, 4, 5, 6];
    return !workDays.includes(dayOfWeek);
  };

  const getScheduledHours = (staffId: string, dayOfWeek: number) => {
    const scheds = getScheduleForDay(staffId, dayOfWeek);
    return scheds.reduce((sum: number, s: any) => {
      const [sH, sM] = s.start_time.split(":").map(Number);
      const [eH, eM] = s.end_time.split(":").map(Number);
      return sum + (eH + eM / 60) - (sH + sM / 60);
    }, 0);
  };

  const recordMap = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    records.forEach((r: any) => {
      if (!m[r.staff_id]) m[r.staff_id] = {};
      m[r.staff_id][r.date] = r;
    });
    return m;
  }, [records]);

  const toggleMutation = useMutation({
    mutationFn: async ({ staffId, date, status, check_in, check_out, extra_punches }: { staffId: string; date: string; status: string; check_in?: string; check_out?: string; extra_punches?: any[] }) => {
      const existing = recordMap[staffId]?.[date];
      const payload: any = { status };
      if (check_in !== undefined) payload.check_in_time = check_in || null;
      if (check_out !== undefined) payload.check_out_time = check_out || null;
      if (extra_punches !== undefined) payload.extra_punches = extra_punches;

      if (existing) {
        const { error } = await supabase.from("attendance_records").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").insert({ staff_id: staffId, date, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance_records", month, year] }),
    onError: () => toast.error("Error al marcar asistencia"),
  });

  const cycleStatus = (staffId: string, day: number) => {
    if (!isAdmin) return;
    const dayOfWeek = new Date(year, month, day).getDay();
    const rest = isRestDay(staffId, dayOfWeek);
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const current = recordMap[staffId]?.[date]?.status;

    // If it's a rest day, only allow toggling between nothing and special statuses
    if (rest) {
      // Allow admin to override rest day (e.g., staff worked a Sunday)
      const restOrder = ["A", "T", "J", ""];
      const idx = restOrder.indexOf(current || "");
      const next = restOrder[(idx + 1) % restOrder.length];
      if (next === "") {
        // Remove the record
        const existing = recordMap[staffId]?.[date];
        if (existing) {
          supabase.from("attendance_records").delete().eq("id", existing.id).then(() => {
            qc.invalidateQueries({ queryKey: ["attendance_records", month, year] });
          });
        }
        return;
      }
      toggleMutation.mutate({ staffId, date, status: next });
      return;
    }

    const order = ["A", "T", "J", "F"];
    const next = order[(order.indexOf(current || "") + 1) % order.length];
    toggleMutation.mutate({ staffId, date, status: next });
  };

  const updateTime = (staffId: string, day: number, field: "check_in" | "check_out", value: string) => {
    if (!canEditAttendanceGrid) return;
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existing = recordMap[staffId]?.[date];
    const status = existing?.status || "A";
    toggleMutation.mutate({
      staffId, date, status,
      check_in: field === "check_in" ? value : existing?.check_in_time || undefined,
      check_out: field === "check_out" ? value : existing?.check_out_time || undefined,
    });
  };

  const getActualHours = (rec: any) => {
    let total = 0;
    const addPair = (i: string, o: string) => {
      const [inH, inM] = i.split(":").map(Number);
      const [outH, outM] = o.split(":").map(Number);
      let diff = (outH + outM / 60) - (inH + inM / 60);
      if (diff < 0) diff += 24;
      total += diff;
    };
    if (rec?.check_in_time && rec?.check_out_time) addPair(rec.check_in_time, rec.check_out_time);
    if (Array.isArray(rec?.extra_punches)) {
      rec.extra_punches.forEach((p: any) => {
        if (p?.in && p?.out) addPair(p.in, p.out);
      });
    }
    return total;
  };

  const getStats = (staffId: string) => {
    const recs = Object.values(recordMap[staffId] || {});
    const a = recs.filter((r: any) => r.status === "A").length;
    const f = recs.filter((r: any) => r.status === "F").length;
    const t = recs.filter((r: any) => r.status === "T").length;
    const j = recs.filter((r: any) => r.status === "J").length;
    const total = a + f + t + j;
    const pct = total > 0 ? Math.round((a / total) * 100) : 0;

    // Count scheduled work days up to today for attendance %
    const today = new Date();
    let workDaysCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (date > today) break;
      if (!isRestDay(staffId, date.getDay())) workDaysCount++;
    }

    let totalWorked = 0;
    let totalScheduled = 0;
    recs.forEach((r: any) => {
      const actualH = getActualHours(r);
      totalWorked += actualH;
      const d = new Date(r.date);
      const scheduledH = getScheduledHours(staffId, d.getDay());
      totalScheduled += scheduledH;
    });

    const overtime = Math.max(0, totalWorked - totalScheduled);

    return {
      a, f, t, j, pct,
      workDaysCount,
      totalHours: Math.round(totalWorked * 10) / 10,
      scheduledHours: Math.round(totalScheduled * 10) / 10,
      overtime: Math.round(overtime * 10) / 10,
    };
  };

  const getWeeklyStats = (staffId: string) => {
    const weeks: { week: number; worked: number; scheduled: number; overtime: number; days: number }[] = [];
    const recs = recordMap[staffId] || {};
    for (let w = 0; w < 5; w++) {
      let worked = 0, scheduled = 0, daysCount = 0;
      for (let d = w * 7 + 1; d <= Math.min((w + 1) * 7, daysInMonth); d++) {
        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const rec = recs[date];
        const dayOfWeek = new Date(year, month, d).getDay();
        const schedH = getScheduledHours(staffId, dayOfWeek);
        if (rec?.status === "A" || rec?.status === "T") {
          daysCount++;
          const actualH = getActualHours(rec);
          worked += actualH;
          scheduled += schedH;
        }
      }
      if (daysCount > 0) {
        const ot = Math.max(0, worked - scheduled);
        weeks.push({ week: w + 1, worked: Math.round(worked * 10) / 10, scheduled: Math.round(scheduled * 10) / 10, overtime: Math.round(ot * 10) / 10, days: daysCount });
      }
    }
    return weeks;
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const getDayOfWeek = (day: number) => ["D","L","M","M","J","V","S"][new Date(year, month, day).getDay()];

  const attendanceStaff = useMemo(
    () => staff.filter((s: any) => !s.user_id || !terminalUserIds.includes(s.user_id)),
    [staff, terminalUserIds]
  );

  const filteredStaff = filterStaff === "all" ? attendanceStaff : attendanceStaff.filter((s: any) => s.id === filterStaff);

  const exportExcel = () => {
    // Header row
    const header = ["Personal", "Cargo", ...days.map(d => {
      const dow = new Date(year, month, d).getDay();
      return `${DAY_NAMES_SHORT[dow]} ${d}`;
    }), "Asistencias", "Faltas", "Tardanzas", "Justificadas", "% Asist.", "Horas Trabajadas", "Horas Programadas", "Horas Extra"];

    const dataRows = filteredStaff.map((s: any) => {
      const st = getStats(s.id);
      const dayCols = days.map(d => {
        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const rec = recordMap[s.id]?.[date];
        const dayOfWeek = new Date(year, month, d).getDay();
        if (!rec && isRestDay(s.id, dayOfWeek)) return "D";
        let val = rec?.status || "";
        if (rec?.check_in_time) val += ` ${rec.check_in_time.slice(0,5)}`;
        if (rec?.check_out_time) val += `-${rec.check_out_time.slice(0,5)}`;
        return val;
      });
      return [s.full_name, s.position, ...dayCols, st.a, st.f, st.t, st.j, `${st.pct}%`, `${st.totalHours}h`, `${st.scheduledHours}h`, `${st.overtime}h`];
    });

    const allRows = [
      [`CONTROL DE ASISTENCIAS — ${MONTHS[month].toUpperCase()} ${year}`],
      [],
      header,
      ...dataRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(allRows);

    // Column widths
    ws["!cols"] = [
      { wch: 22 }, { wch: 16 },
      ...days.map(() => ({ wch: 14 })),
      { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    ];

    // Merge title row
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

    // Add borders to all data cells (header + data rows, starting row 2)
    const borderStyle = { style: "thin", color: { rgb: "999999" } };
    const border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
    const totalCols = header.length;
    const startRow = 2; // row index of header (0-based)
    const endRow = 2 + dataRows.length;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = 0; c < totalCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
        ws[cellRef].s = {
          border,
          alignment: { horizontal: "center", vertical: "center" },
          ...(r === startRow ? {
            fill: { fgColor: { rgb: "2D7D46" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
          } : {}),
        };
      }
    }
    // Title style
    const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (ws[titleRef]) {
      ws[titleRef].s = {
        font: { bold: true, sz: 14, color: { rgb: "1a5c2e" } },
        alignment: { horizontal: "left" },
      };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencias");

    // Summary sheet with borders
    const summaryHeader = ["Personal", "Cargo", "Asistencias", "Faltas", "Tardanzas", "Justificadas", "% Asistencia", "Total Horas", "Horas Programadas", "Horas Extra"];
    const summaryRows = filteredStaff.map((s: any) => {
      const st = getStats(s.id);
      return [s.full_name, s.position, st.a, st.f, st.t, st.j, `${st.pct}%`, `${st.totalHours}h`, `${st.scheduledHours}h`, `${st.overtime}h`];
    });
    const summaryAll = [
      [`RESUMEN DE ASISTENCIAS — ${MONTHS[month].toUpperCase()} ${year}`],
      [],
      summaryHeader,
      ...summaryRows,
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryAll);
    ws2["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
    ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    // Borders for summary
    for (let r = 2; r <= 2 + summaryRows.length; r++) {
      for (let c = 0; c < summaryHeader.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws2[cellRef]) ws2[cellRef] = { v: "", t: "s" };
        ws2[cellRef].s = {
          border,
          alignment: { horizontal: "center", vertical: "center" },
          ...(r === 2 ? {
            fill: { fgColor: { rgb: "2D7D46" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
          } : {}),
        };
      }
    }
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

    XLSX.writeFile(wb, `asistencias_${MONTHS[month]}_${year}.xlsx`);
    toast.success("📊 Excel descargado correctamente");
  };

  const saveBusinessHours = async () => {
    setSavingHours(true);
    try {
      const { data: existing } = await supabase.from("store_settings").select("id").eq("key", "business_hours").maybeSingle();
      if (existing) {
        await supabase.from("store_settings").update({ value: editHours as any }).eq("key", "business_hours");
      } else {
        await supabase.from("store_settings").insert({ key: "business_hours", value: editHours as any });
      }
      qc.invalidateQueries({ queryKey: ["store_settings", "business_hours"] });
      toast.success("✅ Horario de atención guardado");
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    }
    setSavingHours(false);
  };

  const toggleWorkDay = (day: number) => {
    setEditHours(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day].sort(),
    }));
  };

  const selfCheckIn = async () => {
    const today = new Date().toISOString().split("T")[0];
    const nowTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) { toast.error("Debes iniciar sesión"); return; }

    const currentStaff = staff.find((s: any) => s.user_id === session.session!.user.id);
    if (!currentStaff) { toast.error("Tu usuario no está vinculado a un registro de personal"); return; }

    const existing = recordMap[currentStaff.id]?.[today];
    const dayOfWeek = new Date().getDay();
    const rest = isRestDay(currentStaff.id, dayOfWeek);

    // If already checked in and not checked out → mark checkout
    if (existing?.check_in_time && !existing?.check_out_time) {
      // Calculate if there are overtime hours
      const todaySchedules = getScheduleForDay(currentStaff.id, dayOfWeek);
      let scheduledEnd = "20:00";
      if (todaySchedules.length > 0) {
        scheduledEnd = todaySchedules.reduce((max: string, s: any) => s.end_time > max ? s.end_time : max, todaySchedules[0].end_time);
      }
      const hasOvertime = nowTime > scheduledEnd;
      toggleMutation.mutate({ staffId: currentStaff.id, date: today, status: existing.status || "A", check_out: nowTime });
      toast.success(
        hasOvertime
          ? `Salida registrada: ${nowTime} 🔥 ¡Horas extra detectadas!`
          : `Salida registrada: ${nowTime}`
      );
      return;
    }

    // If already checked in AND checked out → start NEW shift (double turno)
    // Push completed pair to extra_punches and reset check_in/check_out for the new shift
    if (existing?.check_in_time && existing?.check_out_time) {
      const prevExtras = Array.isArray(existing.extra_punches) ? existing.extra_punches : [];
      const newExtras = [...prevExtras, { in: existing.check_in_time, out: existing.check_out_time, label: "Turno previo" }];
      toggleMutation.mutate({
        staffId: currentStaff.id, date: today,
        status: existing.status || "A",
        check_in: nowTime,
        check_out: "",
        extra_punches: newExtras,
      });
      const completed = prevExtras.length + 1;
      toast.success(`🔄 Nuevo turno iniciado a las ${nowTime}. Turnos completados hoy: ${completed}. Marca salida cuando termines.`);
      return;
    }

    // No check-in yet
    if (rest) {
      // Allow check-in on rest day with notice
      toggleMutation.mutate({ staffId: currentStaff.id, date: today, status: "A", check_in: nowTime });
      toast.success(`Entrada en día de descanso registrada: ${nowTime} 💪 ¡Se contará como hora extra!`);
      return;
    }

    const todaySchedules = getScheduleForDay(currentStaff.id, dayOfWeek);
    let isLate = false;
    let lateBy = 0;
    const tolerance = Number(businessHours?.tolerance_minutes ?? 5);
    if (todaySchedules.length > 0) {
      const earliest = todaySchedules.reduce((min: string, s: any) => s.start_time < min ? s.start_time : min, todaySchedules[0].start_time);
      const [eh, em] = earliest.split(":").map(Number);
      const [nh, nm] = nowTime.split(":").map(Number);
      lateBy = (nh * 60 + nm) - (eh * 60 + em);
      isLate = lateBy > tolerance;
    }
    const status = isLate ? "T" : "A";
    toggleMutation.mutate({ staffId: currentStaff.id, date: today, status, check_in: nowTime });
    toast.success(`Entrada registrada: ${nowTime}${isLate ? ` (Tardanza +${lateBy} min, tolerancia ${tolerance} min)` : tolerance > 0 && lateBy > 0 ? ` (Dentro de tolerancia ${tolerance} min)` : ""}`);
  };


  const myStaff = staff.find((s: any) => s.user_id === user?.id);
  const today = new Date().toISOString().split("T")[0];
  const myRecord = myStaff ? recordMap[myStaff.id]?.[today] : null;
  const myCheckedIn = !!myRecord?.check_in_time;
  const myCheckedOut = !!myRecord?.check_out_time;
  const quickAttendanceStaff = isTerminal ? attendanceStaff : attendanceStaff;

  // Format business hours for display
  const formatBusinessHours = () => {
    if (!businessHours) return "9:00 AM - 1:00 PM y 3:00 PM - 8:00 PM";
    const fmt = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    };
    return `${fmt(businessHours.morning_start)} - ${fmt(businessHours.morning_end)} y ${fmt(businessHours.afternoon_start)} - ${fmt(businessHours.afternoon_end)}`;
  };

  return (
    <div className="space-y-6">
      {/* Self check-in card for staff */}
      {!canUseControlView && myStaff && (
        <Card className={`border-2 ${myCheckedIn && !myCheckedOut ? "border-primary/50 bg-primary/5" : myCheckedOut ? "border-success/50 bg-success/5" : "border-warning/50 bg-warning/5"}`}>
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${myCheckedIn && !myCheckedOut ? "bg-primary/20" : myCheckedOut ? "bg-success/20" : "bg-warning/20"}`}>
                {myCheckedOut ? <Clock className="h-6 w-6 text-success" /> : myCheckedIn ? <UserCheck className="h-6 w-6 text-primary" /> : <AlertTriangle className="h-6 w-6 text-warning" />}
              </div>
              <div>
                <p className="font-semibold">{myStaff.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {myCheckedOut
                    ? `✅ Jornada completada — Entrada: ${myRecord?.check_in_time} | Salida: ${myRecord?.check_out_time}. ¿Necesitas volver? Presiona Re-entrar.`
                    : myCheckedIn
                    ? `🟢 En turno desde las ${myRecord?.check_in_time} — Presiona para marcar salida`
                    : "⚠️ Aún no has marcado tu entrada hoy"}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="gap-2 min-w-[200px]"
              variant={myCheckedOut ? "secondary" : "default"}
              onClick={selfCheckIn}
            >
              <UserCheck className="h-5 w-5" />
              {myCheckedOut ? "🔄 Re-entrar (Turno Extra)" : myCheckedIn ? "Marcar Salida" : "Marcar Entrada"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!canUseControlView && !myStaff && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm">Tu cuenta no está vinculada a un registro de personal. Solicita al administrador que te vincule para poder marcar asistencia.</p>
          </CardContent>
        </Card>
      )}

      {/* Personal view (non-admin) */}
      {!canUseControlView && myStaff && (() => {
        const myStats = getStats(myStaff.id);
        const mySchedules = scheduleMap[myStaff.id] || [];
        return (
          <>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                <CalendarDays className="h-6 w-6 text-primary" /> Mi Asistencia
              </h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="font-semibold text-sm min-w-[160px] text-center">{MONTHS[month]} {year}</span>
                <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card className="border-success/20"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-success">{myStats.a}</p><p className="text-[10px] text-muted-foreground">Asistencias</p></CardContent></Card>
              <Card className="border-destructive/20"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{myStats.f}</p><p className="text-[10px] text-muted-foreground">Faltas</p></CardContent></Card>
              <Card className="border-warning/20"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-warning">{myStats.t}</p><p className="text-[10px] text-muted-foreground">Tardanzas</p></CardContent></Card>
              <Card className="border-info/20"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-info">{myStats.j}</p><p className="text-[10px] text-muted-foreground">Justificadas</p></CardContent></Card>
              <Card className="border-primary/20"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{myStats.totalHours}h</p><p className="text-[10px] text-muted-foreground">Horas Trabajadas</p></CardContent></Card>
              <Card className={`border-2 ${myStats.pct >= 80 ? "border-success/30" : myStats.pct >= 50 ? "border-warning/30" : "border-destructive/30"}`}>
                <CardContent className="p-3 text-center">
                  <p className={`text-2xl font-bold ${myStats.pct >= 80 ? "text-success" : myStats.pct >= 50 ? "text-warning" : "text-destructive"}`}>{myStats.pct}%</p>
                  <p className="text-[10px] text-muted-foreground">Puntualidad</p>
                </CardContent>
              </Card>
            </div>

            {myStats.overtime > 0 && (
              <Card className="border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-medium">Horas extras acumuladas: <strong className="text-orange-400">{myStats.overtime}h</strong></span>
                  <span className="text-xs text-muted-foreground ml-2">(Programadas: {myStats.scheduledHours}h)</span>
                </CardContent>
              </Card>
            )}

            {mySchedules.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Mi Horario Asignado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {mySchedules
                      .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
                      .map((sc: any) => (
                        <div key={sc.id} className="bg-secondary/30 rounded-lg p-3 text-center">
                          <p className="text-xs font-semibold text-primary">{DAY_NAMES[sc.day_of_week]}</p>
                          <p className="text-sm font-mono mt-1">{sc.start_time?.slice(0, 5)} - {sc.end_time?.slice(0, 5)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{sc.shift_name}</p>
                        </div>
                      ))}
                  </div>
                  {/* Show rest days */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Sun className="h-3.5 w-3.5" />
                    <span>Días de descanso: {
                      DAY_NAMES.filter((_, i) => !mySchedules.some((s: any) => s.day_of_week === i))
                        .join(", ") || "Ninguno"
                    }</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* My daily log (read-only) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Registro Diario — {MONTHS[month]} {year}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="px-3 py-2 text-left">Día</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                        <th className="px-3 py-2 text-center">Entrada</th>
                        <th className="px-3 py-2 text-center">Salida</th>
                        <th className="px-3 py-2 text-center">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map(d => {
                        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        const rec = recordMap[myStaff.id]?.[date];
                        const dayOfWeek = new Date(year, month, d).getDay();
                        const dayName = DAY_NAMES[dayOfWeek];
                        const rest = isRestDay(myStaff.id, dayOfWeek);
                        const isFuture = new Date(year, month, d) > new Date();
                        if (isFuture && !rec) return null;
                        const st = rec ? STATUS_LABELS[rec.status] : (rest ? STATUS_LABELS["D"] : null);
                        const hours = getActualHours(rec);
                        return (
                          <tr key={d} className={`border-t border-border/50 ${rest ? "bg-muted/30 opacity-60" : ""}`}>
                            <td className="px-3 py-2 font-medium">
                              <span className="text-muted-foreground mr-1">{dayName.slice(0, 3)}</span> {d}
                              {rest && <Badge variant="outline" className="ml-2 text-[8px] bg-gray-500/10 text-gray-400">Descanso</Badge>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {st ? (
                                <Badge variant="outline" className={`${st.color} text-[10px]`}>{st.full}</Badge>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-mono">{rec?.check_in_time?.slice(0, 5) || "—"}</td>
                            <td className="px-3 py-2 text-center font-mono">{rec?.check_out_time?.slice(0, 5) || "—"}</td>
                            <td className="px-3 py-2 text-center font-mono font-semibold text-primary">
                              {hours > 0 ? `${Math.round(hours * 10) / 10}h` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 italic">
                  📌 Si notas algún error en tu asistencia, comunícate con tu supervisor o administrador para corregirlo.
                </p>
              </CardContent>
            </Card>
          </>
        );
      })()}

      {/* ─── Admin / Asistente view: control total o marcado por otros ──── */}
      {canUseControlView && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" /> Control de Asistencias
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" /> Horario
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" /> Horario de Atención
                    </SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Define el horario de la empresa y los días laborales. Los días no marcados serán "Descanso" (D).
                    </p>
                    <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
                      <p className="text-xs font-semibold">🌅 Turno Mañana</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Entrada</Label><Input type="time" className="[color-scheme:dark] dark:[color-scheme:dark]" value={editHours.morning_start} onChange={e => setEditHours(p => ({ ...p, morning_start: e.target.value }))} /></div>
                        <div><Label className="text-xs">Salida</Label><Input type="time" className="[color-scheme:dark] dark:[color-scheme:dark]" value={editHours.morning_end} onChange={e => setEditHours(p => ({ ...p, morning_end: e.target.value }))} /></div>
                      </div>
                    </div>
                    <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
                      <p className="text-xs font-semibold">🌇 Turno Tarde</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Entrada</Label><Input type="time" className="[color-scheme:dark] dark:[color-scheme:dark]" value={editHours.afternoon_start} onChange={e => setEditHours(p => ({ ...p, afternoon_start: e.target.value }))} /></div>
                        <div><Label className="text-xs">Salida</Label><Input type="time" className="[color-scheme:dark] dark:[color-scheme:dark]" value={editHours.afternoon_end} onChange={e => setEditHours(p => ({ ...p, afternoon_end: e.target.value }))} /></div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Días Laborales</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAY_NAMES.map((name, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                              editHours.work_days.includes(i)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-muted/30 text-muted-foreground opacity-60"
                            }`}
                            onClick={() => toggleWorkDay(i)}
                          >
                            <Checkbox checked={editHours.work_days.includes(i)} onCheckedChange={() => toggleWorkDay(i)} />
                            <span className="text-sm font-medium">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 p-3 rounded-lg bg-secondary/30">
                      <p className="text-xs font-semibold">⏱️ Tolerancia para marcar entrada</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={120}
                          value={editHours.tolerance_minutes ?? 5}
                          onChange={e => setEditHours(p => ({ ...p, tolerance_minutes: Math.max(0, Number(e.target.value) || 0) }))}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground">minutos. Entradas dentro de este margen no contarán como tardanza.</span>
                      </div>
                    </div>
                    <Button onClick={saveBusinessHours} disabled={savingHours} className="w-full">
                      {savingHours ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Guardar Horario
                    </Button>

                  </div>
                </SheetContent>
              </Sheet>
              )}
              <Button variant="outline" size="sm" className="gap-2" onClick={exportExcel}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (!confirm(`¿Marcar como FALTA los días laborales pasados de ${MONTHS[month]} ${year} que no tengan registro?`)) return;
                    const { data, error } = await supabase.rpc("admin_mark_pending_absences", { _year: year, _month: month + 1 });
                    if (error) { toast.error("Error: " + error.message); return; }
                    toast.success(`✅ ${data ?? 0} faltas registradas`);
                    qc.invalidateQueries({ queryKey: ["attendance_records", month, year] });
                  }}
                >
                  <AlertTriangle className="h-4 w-4" /> Marcar Faltas
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => {
                  const statsMap: Record<string, any> = {};
                  staff.forEach((s: any) => { statsMap[s.id] = getStats(s.id); });
                  generateMonthlyAttendancePdf({
                    month, year,
                    staffList: staff.map((s: any) => ({ id: s.id, full_name: s.full_name, position: s.position })),
                    recordsByStaff: recordMap,
                    statsByStaff: statsMap,
                    isRestDay,
                  });
                  toast.success("📄 PDF general descargado");
                }}
              >
                <FileText className="h-4 w-4" /> PDF General
              </Button>
              <div className="flex items-center gap-1">
                <Select value={pdfStaffId} onValueChange={setPdfStaffId}>
                  <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Trabajador..." /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-accent/30 text-accent hover:bg-accent/10"
                  disabled={!pdfStaffId}
                  onClick={() => {
                    const s = staff.find((x: any) => x.id === pdfStaffId);
                    if (!s) return;
                    const stats = getStats(s.id);
                    generateMonthlyAttendancePdf({
                      month, year,
                      staffList: [{ id: s.id, full_name: s.full_name, position: s.position }],
                      recordsByStaff: { [s.id]: recordMap[s.id] || {} },
                      statsByStaff: { [s.id]: stats },
                      isRestDay,
                      individual: true,
                    });
                    toast.success(`📄 PDF individual de ${s.full_name} descargado`);
                  }}
                >
                  <User className="h-4 w-4" /> PDF
                </Button>
              </div>
              <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="font-semibold text-sm min-w-[160px] text-center">{MONTHS[month]} {year}</span>
              <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Admin quick check-in */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Marcar Asistencia Rápida — Hoy</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {quickAttendanceStaff.map((s: any) => {
                  const todayDate = new Date().toISOString().split("T")[0];
                  const rec = recordMap[s.id]?.[todayDate];
                  const hasIn = !!rec?.check_in_time;
                  const hasOut = !!rec?.check_out_time;
                  const nowTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
                  const todayDow = new Date().getDay();
                  const rest = isRestDay(s.id, todayDow);
                  const todaySchedules = getScheduleForDay(s.id, todayDow);

                  const canUseQuickPunch = canMarkOthers || (isTerminal && s.user_id === user?.id);

                  return (
                    <div key={s.id} className={`rounded-lg p-3 text-center border transition-colors ${
                      rest && !hasIn ? "bg-gray-500/5 border-gray-500/20 opacity-60" :
                      hasOut ? "bg-success/10 border-success/30" : 
                      hasIn ? "bg-primary/10 border-primary/30" : 
                      "bg-secondary/30 border-border"
                    }`}>
                      <p className="text-xs font-semibold truncate">{s.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.position}</p>
                      {rest && !hasIn && (
                        <Badge variant="outline" className="text-[9px] mt-1 bg-gray-500/10 text-gray-400 gap-1">
                          <Sun className="h-2.5 w-2.5" /> Descanso
                        </Badge>
                      )}
                      {todaySchedules.length > 0 && !rest && (
                        <p className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                          {todaySchedules[0].start_time?.slice(0,5)}-{todaySchedules[0].end_time?.slice(0,5)}
                        </p>
                      )}
                      {hasIn && <p className="text-[10px] font-mono mt-1">🕐 {rec?.check_in_time?.slice(0,5)}{hasOut ? ` → ${rec?.check_out_time?.slice(0,5)}` : ""}</p>}
                      <Button
                        size="sm"
                        variant={hasOut ? "outline" : hasIn ? "secondary" : rest ? "ghost" : "default"}
                        className="mt-2 h-7 text-[10px] w-full"
                        disabled={hasOut || !canUseQuickPunch}
                        onClick={() => {
                          if (hasIn && !hasOut) {
                            toggleMutation.mutate({ staffId: s.id, date: todayDate, status: "A", check_out: nowTime });
                            toast.success(`Salida de ${s.full_name}: ${nowTime}`);
                          } else if (!hasIn) {
                            let isLate = false;
                            if (todaySchedules.length > 0) {
                              const earliest = todaySchedules.reduce((min: string, sc: any) => sc.start_time < min ? sc.start_time : min, todaySchedules[0].start_time);
                              isLate = nowTime > earliest;
                            }
                            toggleMutation.mutate({ staffId: s.id, date: todayDate, status: isLate ? "T" : "A", check_in: nowTime });
                            toast.success(`Entrada de ${s.full_name}: ${nowTime}${isLate ? " (Tardanza)" : ""}${rest ? " (Día de descanso)" : ""}`);
                          }
                        }}
                      >
                        {hasOut ? "✅ Completo" : hasIn ? "Marcar Salida" : rest ? "☀️ Descanso" : "Marcar Entrada"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 p-2 bg-secondary/30 rounded-lg flex items-center justify-between flex-wrap gap-2">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Horario empresa: <strong>{formatBusinessHours()}</strong>
                </p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[9px] bg-gray-500/10 text-gray-400 gap-1">
                    <Sun className="h-2.5 w-2.5" /> = Día de descanso
                  </Badge>
                  <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-400">
                    ✅ = Jornada completa
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters & legend */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Filtrar personal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el personal</SelectItem>
                  {staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <Badge key={k} variant="outline" className={`${v.color} text-xs`}>{v.label} = {v.full}</Badge>
              ))}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="grid">📅 Cuadrícula</TabsTrigger>
              <TabsTrigger value="hours">⏱️ Horas</TabsTrigger>
              <TabsTrigger value="summary">📊 Resumen</TabsTrigger>
            </TabsList>

            {/* Grid View */}
            <TabsContent value="grid">
              {filteredStaff.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground"><CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Registra personal primero</p></CardContent></Card>
              ) : (
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="sticky left-0 bg-muted/50 z-10 px-3 py-2 text-left font-semibold min-w-[150px]">Personal</th>
                        {days.map(d => {
                          const dow = new Date(year, month, d).getDay();
                          const isSunday = dow === 0;
                          return (
                            <th key={d} className={`px-1 py-1 text-center min-w-[32px] ${isSunday ? "bg-orange-500/5" : ""}`}>
                              <div className={`text-muted-foreground ${isSunday ? "text-orange-400 font-bold" : ""}`}>{getDayOfWeek(d)}</div>
                              <div className={isSunday ? "text-orange-400" : ""}>{d}</div>
                            </th>
                          );
                        })}
                        <th className="px-2 py-2 text-center">A</th>
                        <th className="px-2 py-2 text-center">F</th>
                        <th className="px-2 py-2 text-center">T</th>
                        <th className="px-2 py-2 text-center">J</th>
                        <th className="px-2 py-2 text-center">%</th>
                        <th className="px-2 py-2 text-center" title="Horas reales trabajadas en el mes (entrada + salidas + turnos extra)">Horas Mes</th>
                        <th className="px-2 py-2 text-center" title="⚠️ Cálculo en revisión — pendiente de optimización técnica">Extra*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map((s: any) => {
                        const stats = getStats(s.id);
                        return (
                          <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                            <td className="sticky left-0 bg-card z-10 px-3 py-2 font-medium truncate max-w-[150px]">{s.full_name}</td>
                            {days.map(d => {
                              const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                              const rec = recordMap[s.id]?.[date];
                              const dayOfWeek = new Date(year, month, d).getDay();
                              const rest = isRestDay(s.id, dayOfWeek);
                              const st = rec ? STATUS_LABELS[rec.status] : null;
                              const isFuture = new Date(year, month, d) > new Date();

                              // Rest day without attendance record
                              if (rest && !rec) {
                                return (
                                  <td key={d} className={`px-1 py-1 text-center bg-gray-500/5 transition-colors ${canEditAttendanceGrid ? "cursor-pointer hover:bg-gray-500/10" : "cursor-default"}`}
                                    onClick={() => canEditAttendanceGrid && cycleStatus(s.id, d)}
                                    title={canEditAttendanceGrid ? "Descanso — Clic para registrar asistencia extra" : "Descanso"}>
                                    <span className="inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold bg-gray-500/15 text-gray-500">D</span>
                                  </td>
                                );
                              }

                              return (
                                <td key={d} className={`px-1 py-1 text-center transition-colors ${canEditAttendanceGrid ? "cursor-pointer hover:bg-primary/10" : "cursor-default"} ${rest ? "bg-gray-500/5" : ""}`}
                                  onClick={() => canEditAttendanceGrid && cycleStatus(s.id, d)}>
                                  {st ? (
                                    <span className={`inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold ${st.color} ${rest ? "ring-1 ring-orange-400/50" : ""}`} 
                                      title={rest ? `${st.full} (trabajó en día de descanso)` : st.full}>
                                      {st.label}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/30">{isFuture ? "" : "·"}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-center font-bold text-success">{stats.a || ""}</td>
                            <td className="px-2 py-2 text-center font-bold text-destructive">{stats.f || ""}</td>
                            <td className="px-2 py-2 text-center font-bold text-warning">{stats.t || ""}</td>
                            <td className="px-2 py-2 text-center font-bold text-info">{stats.j || ""}</td>
                            <td className={`px-2 py-2 text-center font-bold ${stats.pct >= 80 ? "text-success" : stats.pct >= 50 ? "text-warning" : "text-destructive"}`}>
                              {stats.pct > 0 ? `${stats.pct}%` : ""}
                            </td>
                            <td className="px-2 py-2 text-center font-bold text-primary" title="Horas reales trabajadas en el mes">
                              {stats.totalHours > 0 ? `${stats.totalHours}h` : ""}
                            </td>
                            <td className="px-2 py-2 text-center font-bold text-orange-400" title="Cálculo en revisión">
                              {stats.overtime > 0 ? `${stats.overtime}h` : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Hours View */}
            <TabsContent value="hours">
              <div className="space-y-4">
                {filteredStaff.map((s: any) => {
                  const stats = getStats(s.id);
                  const weeks = getWeeklyStats(s.id);
                  const staffSchedules = scheduleMap[s.id] || [];
                  const restDays = DAY_NAMES.filter((_, i) => isRestDay(s.id, i));
                  return (
                    <Card key={s.id} className="border-primary/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
                          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{s.full_name}</span>
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{stats.totalHours}h trabajadas</Badge>
                            <Badge variant="outline" className="text-xs bg-muted">{stats.scheduledHours}h programadas</Badge>
                            {stats.overtime > 0 && (
                              <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400">
                                <AlertTriangle className="h-3 w-3 mr-1" />{stats.overtime}h extras
                              </Badge>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Schedule + rest days info */}
                        <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                          {staffSchedules.length > 0 ? (
                            <>
                              <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Horario Asignado:</p>
                              <div className="flex gap-2 flex-wrap">
                                {staffSchedules
                                  .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
                                  .map((sc: any) => (
                                  <Badge key={sc.id} variant="outline" className="text-[10px]">
                                    {DAY_NAMES[sc.day_of_week]?.slice(0, 3)}: {sc.start_time?.slice(0,5)}-{sc.end_time?.slice(0,5)}
                                    <span className="ml-1 text-muted-foreground">({sc.shift_name})</span>
                                  </Badge>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="text-[10px] text-muted-foreground italic">⚠️ Sin horario asignado — se usa el horario general de la empresa</p>
                          )}
                          {restDays.length > 0 && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Sun className="h-3 w-3 text-orange-400" /> Descanso: <strong className="text-orange-400">{restDays.join(", ")}</strong>
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {weeks.map(w => (
                            <div key={w.week} className="bg-secondary/30 rounded-lg p-2 text-center">
                              <p className="text-[10px] text-muted-foreground">Semana {w.week}</p>
                              <p className="text-sm font-bold text-primary">{w.worked}h</p>
                              <p className="text-[10px] text-muted-foreground">{w.scheduled}h prog.</p>
                              {w.overtime > 0 && <p className="text-[10px] font-bold text-orange-400">+{w.overtime}h extra</p>}
                              <p className="text-[10px] text-muted-foreground">{w.days} días</p>
                            </div>
                          ))}
                        </div>

                        <div className="overflow-x-auto">
                          <div className="flex gap-1">
                            {days.map(d => {
                              const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                              const rec = recordMap[s.id]?.[date];
                              const dayOfWeek = new Date(year, month, d).getDay();
                              const rest = isRestDay(s.id, dayOfWeek);
                              return (
                                <div key={d} className={`flex flex-col items-center min-w-[50px] p-1 rounded text-[10px] ${rest ? "bg-orange-500/5 border border-orange-500/10" : ""}`}>
                                  <span className={`text-muted-foreground ${rest ? "text-orange-400 font-bold" : ""}`}>{getDayOfWeek(d)} {d}</span>
                                  {rest && !rec ? (
                                    <span className="text-gray-500 py-2 text-[9px]">🌙</span>
                                  ) : rec?.status === "A" || rec?.status === "T" ? (
                                    <>
                                      <Input
                                        type="time"
                                        value={rec?.check_in_time || ""}
                                        onChange={e => updateTime(s.id, d, "check_in", e.target.value)}
                                        disabled={!canEditAttendanceGrid}
                                        className="h-5 w-full text-[10px] p-0.5 text-center border-primary/20 [color-scheme:dark] dark:[color-scheme:dark]"
                                      />
                                      <Input
                                        type="time"
                                        value={rec?.check_out_time || ""}
                                        onChange={e => updateTime(s.id, d, "check_out", e.target.value)}
                                        disabled={!canEditAttendanceGrid}
                                        className="h-5 w-full text-[10px] p-0.5 text-center border-primary/20 [color-scheme:dark] dark:[color-scheme:dark]"
                                      />
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground/30 py-2">—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* Summary View */}
            <TabsContent value="summary">
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-3 text-left font-semibold">Personal</th>
                      <th className="px-3 py-3 text-center">Cargo</th>
                      <th className="px-3 py-3 text-center">Horario</th>
                      <th className="px-3 py-3 text-center text-success">A</th>
                      <th className="px-3 py-3 text-center text-destructive">F</th>
                      <th className="px-3 py-3 text-center text-warning">T</th>
                      <th className="px-3 py-3 text-center text-info">J</th>
                      <th className="px-3 py-3 text-center">%</th>
                      <th className="px-3 py-3 text-center">Trabajadas</th>
                      <th className="px-3 py-3 text-center">Programadas</th>
                      <th className="px-3 py-3 text-center text-orange-400">Extras</th>
                      <th className="px-3 py-3 text-center text-gray-400">Descansos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((s: any) => {
                      const stats = getStats(s.id);
                      const staffScheds = scheduleMap[s.id] || [];
                      const restDays = DAY_NAMES.filter((_, i) => isRestDay(s.id, i));
                      const shiftName = staffScheds.length > 0
                        ? [...new Set(staffScheds.map((sc: any) => sc.shift_name))].join(", ")
                        : "General";
                      return (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{s.full_name}</td>
                          <td className="px-3 py-3 text-center text-xs text-muted-foreground">{s.position}</td>
                          <td className="px-3 py-3 text-center">
                            <Badge variant="outline" className="text-[10px]">{shiftName}</Badge>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-success">{stats.a}</td>
                          <td className="px-3 py-3 text-center font-bold text-destructive">{stats.f}</td>
                          <td className="px-3 py-3 text-center font-bold text-warning">{stats.t}</td>
                          <td className="px-3 py-3 text-center font-bold text-info">{stats.j}</td>
                          <td className={`px-3 py-3 text-center font-bold ${stats.pct >= 80 ? "text-success" : stats.pct >= 50 ? "text-warning" : "text-destructive"}`}>
                            {stats.pct}%
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-primary">{stats.totalHours}h</td>
                          <td className="px-3 py-3 text-center text-muted-foreground">{stats.scheduledHours}h</td>
                          <td className="px-3 py-3 text-center font-bold text-orange-400">{stats.overtime > 0 ? `${stats.overtime}h` : "—"}</td>
                          <td className="px-3 py-3 text-center text-xs text-gray-400">{restDays.map(d => d.slice(0,3)).join(", ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default AttendancePage;
