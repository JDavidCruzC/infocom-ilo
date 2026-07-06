import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Users, Plus, Search, UserCheck, UserX, Briefcase, Phone, Mail, IdCard, Clock, Trash2, CalendarClock, KeyRound, Eye, EyeOff, FileText, Upload, Download, MapPin, Loader2 } from "lucide-react";
import { usePersistentDraft } from "@/hooks/use-persistent-draft";
import { sanitizeText } from "@/lib/sanitize";
import { StaffDocumentsSection } from "@/features/admin/components/StaffDocumentsSection";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const emptyForm = {
  full_name: "", position: "Practicante", phone: "", email: "", document_number: "", user_id: "", institution: "", address: "",
  start_date: "", end_date: "", end_mode: "date" as "date" | "duration", end_amount: "", end_unit: "months" as "days" | "weeks" | "months" | "years",
};

const addDuration = (isoStart: string, amount: number, unit: "days" | "weeks" | "months" | "years"): string => {
  if (!isoStart || !amount || amount <= 0) return "";
  const d = new Date(isoStart + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  if (unit === "days") d.setDate(d.getDate() + amount);
  else if (unit === "weeks") d.setDate(d.getDate() + amount * 7);
  else if (unit === "months") d.setMonth(d.getMonth() + amount);
  else if (unit === "years") d.setFullYear(d.getFullYear() + amount);
  return d.toISOString().slice(0, 10);
};

const UNIT_LABELS: Record<string, string> = { days: "días", weeks: "semanas", months: "meses", years: "años" };

const emptyScheduleForm = {
  days: [] as number[], shift_name: "Turno Completo", start_time: "09:00", end_time: "18:00",
};

const StaffPage = () => {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleStaffId, setScheduleStaffId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [activeTab, setActiveTab] = useState("staff");
  const [filterPosition, setFilterPosition] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const restoreDraft = useCallback((draft: { editingId: string | null; form: typeof emptyForm }) => {
    if (!draft?.form) return;
    setForm({ ...emptyForm, ...draft.form });
    setEditingId(draft.editingId ?? null);
    setDialogOpen(true);
    toast.info("Se restauró tu borrador de personal");
  }, []);

  const { clearDraft } = usePersistentDraft({
    storageKey: "admin:staff:draft",
    enabled: dialogOpen,
    value: { form, editingId },
    isEmpty: (draft) => !draft.editingId && JSON.stringify(draft.form) === JSON.stringify(emptyForm),
    onRestore: restoreDraft,
  });

  const openNew = () => {
    clearDraft();
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["staff_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_schedules").select("*").order("day_of_week");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_for_staff_link"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .not("user_id", "is", null)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (f: typeof emptyForm) => {
      if (!f.start_date) throw new Error("La fecha de inicio es obligatoria");
      const computedEnd = f.end_mode === "duration"
        ? addDuration(f.start_date, parseInt(f.end_amount || "0", 10), f.end_unit)
        : (f.end_date || "");
      if (computedEnd && computedEnd < f.start_date) throw new Error("La fecha de fin no puede ser anterior a la de inicio");
      const payload: any = {
        full_name: sanitizeText(f.full_name, { maxLength: 120 }), position: f.position,
        phone: f.phone || null, email: f.email || null,
        document_number: f.document_number || null, user_id: f.user_id || null,
        institution: f.institution || null,
        address: sanitizeText(f.address, { maxLength: 240 }) || null,
        start_date: f.start_date,
        end_date: computedEnd || null,
      };
      if (editingId) {
        const { error } = await supabase.from("staff_members").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff_members").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff_members"] });
      toast.success(editingId ? "Personal actualizado" : "Personal registrado");
      clearDraft();
      setForm(emptyForm); setEditingId(null); setDialogOpen(false);
    },
    onError: () => toast.error("Error al guardar"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("staff_members").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff_members"] });
      toast.success("Estado actualizado");
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleStaffId || scheduleForm.days.length === 0) {
        throw new Error("Selecciona al menos un día");
      }
      const rows = scheduleForm.days.map(day => ({
        staff_id: scheduleStaffId,
        day_of_week: day,
        shift_name: scheduleForm.shift_name,
        start_time: scheduleForm.start_time,
        end_time: scheduleForm.end_time,
      }));
      const { error } = await supabase.from("staff_schedules").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff_schedules"] });
      toast.success("Horarios asignados");
      setScheduleForm(emptyScheduleForm);
    },
    onError: (e: any) => toast.error(e.message?.includes("unique") ? "Ya existe ese turno para algún día seleccionado" : e.message || "Error al guardar horario"),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff_schedules"] });
      toast.success("Horario eliminado");
    },
  });

  // Account creation for staff without linked accounts
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountStaffId, setAccountStaffId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({ email: "", password: "", role: "moderator" });
  const [showPassword, setShowPassword] = useState(false);

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const staffMember = staff.find((s: any) => s.id === accountStaffId);
      if (!staffMember) throw new Error("Personal no encontrado");

      const { data, error } = await supabase.functions.invoke("create-staff-account", {
        body: {
          email: accountForm.email,
          password: accountForm.password,
          full_name: staffMember.full_name,
          staff_id: accountStaffId,
          role: accountForm.role,
        },
      });

      if (error) throw new Error(error.message || "Error al crear cuenta");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["staff_members"] });
      qc.invalidateQueries({ queryKey: ["profiles_for_staff_link"] });
      toast.success(data?.message || "Cuenta creada exitosamente");
      setAccountDialogOpen(false);
      setAccountForm({ email: "", password: "", role: "moderator" });
      setAccountStaffId(null);
    },
    onError: (e: any) => toast.error(e.message || "Error al crear cuenta"),
  });

  const openAccountDialog = (s: any) => {
    setAccountStaffId(s.id);
    // Auto-generate email: nombre_apellido@infocomtecnology.ilo
    const autoEmail = s.full_name
      ? s.full_name.trim().toLowerCase().replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "@infocomtecnology.ilo"
      : "";
    // Auto-fill password with DNI
    const autoPassword = s.document_number || "";
    setAccountForm({ email: autoEmail, password: autoPassword, role: "moderator" });
    setShowPassword(false);
    setAccountDialogOpen(true);
  };

  const positions = [...new Set(staff.map((s: any) => s.position))].sort();

  const linkedUserIds = new Set(
    staff
      .filter((s: any) => s.user_id && s.id !== editingId)
      .map((s: any) => s.user_id)
  );

  const availableProfiles = profiles.filter((p: any) => !linkedUserIds.has(p.user_id) || p.user_id === form.user_id);

  const filtered = staff.filter((s: any) => {
    const matchSearch = !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.document_number?.includes(search) || s.phone?.includes(search);
    const matchPosition = filterPosition === "all" || s.position === filterPosition;
    const matchStatus = filterStatus === "all" || (filterStatus === "active" ? s.is_active : !s.is_active);
    return matchSearch && matchPosition && matchStatus;
  });

  const activeCount = staff.filter((s: any) => s.is_active).length;

  const openEdit = (s: any) => {
    setForm({
      full_name: s.full_name, position: s.position, phone: s.phone || "",
      email: s.email || "", document_number: s.document_number || "", user_id: s.user_id || "",
      institution: s.institution || "",
      address: s.address || "",
    });
    setEditingId(s.id); setDialogOpen(true);
  };

  const openScheduleDialog = (staffId: string) => {
    setScheduleStaffId(staffId);
    setScheduleForm(emptyScheduleForm);
    setScheduleDialogOpen(true);
  };

  const getStaffSchedules = (staffId: string) => schedules.filter((s: any) => s.staff_id === staffId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Gestión de Personal
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" /> Agregar Personal</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar" : "Registrar"} Personal</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
              <div><Label>Nombre Completo *</Label><Input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div>
                <Label>Cargo / Posición</Label>
                <Select value={form.position} onValueChange={v => setForm({ ...form, position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Técnico">🔧 Técnico</SelectItem>
                    <SelectItem value="Recepcionista">📋 Recepcionista</SelectItem>
                    <SelectItem value="Vendedor">🛒 Vendedor</SelectItem>
                    <SelectItem value="Practicante">🎓 Practicante</SelectItem>
                    <SelectItem value="Limpieza">🧹 Limpieza</SelectItem>
                    <SelectItem value="Administrador">👑 Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>DNI / Documento</Label><Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div>
                <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" /> Dirección de domicilio</Label>
                <Input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Av. / Calle / Mz / Lt — Distrito, Provincia"
                  maxLength={240}
                />
              </div>
              {(form.position === "Practicante") && (
                <div><Label>Institución / Entidad de origen</Label><Input value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} placeholder="SENATI, TECSUP, Universidad..." /></div>
              )}
              <div>
                <Label>Cuenta del Sistema (opcional)</Label>
                <Select
                  value={form.user_id || "none"}
                  onValueChange={(v) => setForm({ ...form, user_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario registrado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vincular</SelectItem>
                    {availableProfiles.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name || "Sin nombre"} {p.phone ? `• ${p.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Vincula la cuenta para que el personal pueda marcar y ver su asistencia</p>
              </div>
              {editingId && <StaffDocumentsSection staffId={editingId} />}
              {!editingId && (
                <p className="text-[11px] text-muted-foreground italic border border-dashed border-primary/20 rounded p-2">
                  💡 Guarda primero al personal para poder cargar documentos adjuntos (CV en PDF, contratos, etc.).
                </p>
              )}
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{editingId ? "Guardar Cambios" : "Registrar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>


      <div className="grid grid-cols-3 gap-3">
        <Card className="border-green-500/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-400">{activeCount}</p><p className="text-xs text-muted-foreground">Activos</p></CardContent></Card>
        <Card className="border-destructive/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{staff.length - activeCount}</p><p className="text-xs text-muted-foreground">Inactivos</p></CardContent></Card>
        <Card className="border-primary/20"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{staff.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, DNI o teléfono..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterPosition} onValueChange={setFilterPosition}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cargos</SelectItem>
            {positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">✅ Activos</SelectItem>
            <SelectItem value="inactive">❌ Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="staff">👥 Personal</TabsTrigger>
          <TabsTrigger value="schedules">📅 Horarios</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No hay personal registrado</p></CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((s: any) => {
                const staffScheds = getStaffSchedules(s.id);
                return (
                  <Card key={s.id} className={`border-primary/10 ${!s.is_active ? "opacity-50" : ""}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Briefcase className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{s.full_name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <Badge variant="outline" className="text-xs">{s.position}</Badge>
                              {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                              {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                              {s.document_number && <span className="flex items-center gap-1"><IdCard className="h-3 w-3" />{s.document_number}</span>}
                              {s.user_id && <Badge variant="secondary" className="text-[10px]">Cuenta vinculada</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {!s.user_id && (
                            <Button variant="outline" size="sm" onClick={() => openAccountDialog(s)} className="gap-1 text-primary border-primary/30">
                              <KeyRound className="h-3.5 w-3.5" /> Crear Cuenta
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openScheduleDialog(s.id)} className="gap-1">
                            <CalendarClock className="h-3.5 w-3.5" /> Horario
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Editar</Button>
                          <Button variant="ghost" size="icon" className={`h-8 w-8 ${s.is_active ? "text-destructive" : "text-green-400"}`}
                            onClick={() => toggleActiveMutation.mutate({ id: s.id, is_active: !s.is_active })}>
                            {s.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      {/* Show assigned schedules */}
                      {staffScheds.length > 0 && (
                        <div className="flex gap-1 flex-wrap ml-13">
                          {staffScheds.map((sc: any) => (
                            <Badge key={sc.id} variant="secondary" className="text-[10px] gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {DAY_SHORT[sc.day_of_week]}: {sc.start_time?.slice(0,5)}-{sc.end_time?.slice(0,5)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedules">
          <div className="space-y-4">
            {staff.filter((s: any) => s.is_active).map((s: any) => {
              const staffScheds = getStaffSchedules(s.id);
              return (
                <Card key={s.id} className="border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        {s.full_name}
                        <Badge variant="outline" className="text-xs">{s.position}</Badge>
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openScheduleDialog(s.id)} className="gap-1">
                        <Plus className="h-3 w-3" /> Agregar
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {staffScheds.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Sin horario asignado</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {staffScheds.map((sc: any) => (
                          <div key={sc.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-xs font-semibold">{DAY_NAMES[sc.day_of_week]}</p>
                              <p className="text-xs text-muted-foreground">{sc.start_time?.slice(0,5)} - {sc.end_time?.slice(0,5)}</p>
                              <p className="text-[10px] text-muted-foreground">{sc.shift_name}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                              onClick={() => deleteScheduleMutation.mutate(sc.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Schedule assignment dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Horario Personalizado — {staff.find((s: any) => s.id === scheduleStaffId)?.full_name}</DialogTitle>
          </DialogHeader>

          {/* Existing schedule blocks for this worker */}
          {scheduleStaffId && (() => {
            const current = schedules.filter((s: any) => s.staff_id === scheduleStaffId);
            if (current.length === 0) {
              return (
                <div className="rounded-lg border border-dashed border-primary/20 p-3 text-center text-xs text-muted-foreground">
                  Sin bloques asignados. Agrega abajo el primer bloque (ej. Lun/Jue/Vie/Sáb/Dom 15:00-20:00) y guarda; luego añade otro (ej. Mar/Mié 18:00-20:00).
                </div>
              );
            }
            // Group by start-end-shift_name
            const groups: Record<string, { days: number[]; start: string; end: string; shift: string; ids: string[] }> = {};
            current.forEach((sc: any) => {
              const k = `${sc.start_time}-${sc.end_time}-${sc.shift_name}`;
              if (!groups[k]) groups[k] = { days: [], start: sc.start_time, end: sc.end_time, shift: sc.shift_name, ids: [] };
              groups[k].days.push(sc.day_of_week);
              groups[k].ids.push(sc.id);
            });
            return (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Bloques activos</p>
                {Object.values(groups).map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3 gap-2">
                    <div className="text-xs">
                      <p className="font-semibold">{g.shift} · {g.start.slice(0,5)} – {g.end.slice(0,5)}</p>
                      <p className="text-muted-foreground">{g.days.sort().map(d => DAY_SHORT[d]).join(", ")}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive gap-1"
                      onClick={() => g.ids.forEach(id => deleteScheduleMutation.mutate(id))}>
                      <Trash2 className="h-3 w-3" /> Borrar bloque
                    </Button>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="border-t border-border my-2" />
          <p className="text-xs font-semibold text-muted-foreground">Agregar nuevo bloque</p>

          <form onSubmit={e => { e.preventDefault(); saveScheduleMutation.mutate(); }} className="space-y-4">
            <div>
              <Label>Días de la Semana (selecciona varios)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DAY_NAMES.map((d, i) => {
                  const selected = scheduleForm.days.includes(i);
                  // Mark days already assigned somewhere
                  const alreadyAssigned = schedules.some((s: any) => s.staff_id === scheduleStaffId && s.day_of_week === i);
                  return (
                    <Button
                      key={i} type="button" size="sm"
                      variant={selected ? "default" : "outline"}
                      className={alreadyAssigned && !selected ? "border-warning/40 text-warning" : ""}
                      title={alreadyAssigned ? "Ya tiene un bloque asignado este día" : ""}
                      onClick={() => setScheduleForm({
                        ...scheduleForm,
                        days: selected ? scheduleForm.days.filter(x => x !== i) : [...scheduleForm.days, i],
                      })}
                    >
                      {DAY_SHORT[i]}{alreadyAssigned ? " •" : ""}
                    </Button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setScheduleForm({ ...scheduleForm, days: [1,2,3,4,5] })}>Lun-Vie</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setScheduleForm({ ...scheduleForm, days: [1,2,3,4,5,6] })}>Lun-Sáb</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setScheduleForm({ ...scheduleForm, days: [1,4,5,6,0] })}>Lun/Jue/Vie/Sáb/Dom</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setScheduleForm({ ...scheduleForm, days: [2,3] })}>Mar/Mié</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setScheduleForm({ ...scheduleForm, days: [] })}>Limpiar</Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                💡 Los días <strong>no asignados en ningún bloque</strong> se consideran día de descanso automáticamente.
              </p>
            </div>
            <div>
              <Label>Nombre del Turno</Label>
              <Select value={scheduleForm.shift_name} onValueChange={v => {
                let start = scheduleForm.start_time, end = scheduleForm.end_time;
                if (v === "Turno Completo") { start = "09:00"; end = "20:00"; }
                else if (v === "Turno Mañana") { start = "09:00"; end = "13:00"; }
                else if (v === "Turno Tarde") { start = "15:00"; end = "20:00"; }
                else if (v === "Turno Partido") { start = "09:00"; end = "20:00"; }
                else if (v === "Turno Personalizado") { /* keep current times */ }
                setScheduleForm({ ...scheduleForm, shift_name: v, start_time: start, end_time: end });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Turno Personalizado">✨ Turno Personalizado (define horas abajo)</SelectItem>
                  <SelectItem value="Turno Completo">🕐 Turno Completo (09:00-20:00)</SelectItem>
                  <SelectItem value="Turno Mañana">🌅 Turno Mañana (09:00-13:00)</SelectItem>
                  <SelectItem value="Turno Tarde">🌇 Turno Tarde (15:00-20:00)</SelectItem>
                  <SelectItem value="Turno Partido">🔄 Turno Partido (09:00-13:00, 15:00-20:00)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hora Entrada</Label>
                <Input type="time" className="[color-scheme:dark] dark:[color-scheme:dark]" value={scheduleForm.start_time} onChange={e => setScheduleForm({ ...scheduleForm, start_time: e.target.value, shift_name: "Turno Personalizado" })} />
              </div>
              <div>
                <Label>Hora Salida</Label>
                <Input type="time" className="[color-scheme:dark] dark:[color-scheme:dark]" value={scheduleForm.end_time} onChange={e => setScheduleForm({ ...scheduleForm, end_time: e.target.value, shift_name: "Turno Personalizado" })} />
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold">📋 Resumen del bloque a agregar:</p>
              <p>• Días: {scheduleForm.days.length > 0 ? scheduleForm.days.map(d => DAY_NAMES[d]).join(", ") : "Ninguno"}</p>
              <p>• Horario: {scheduleForm.start_time} - {scheduleForm.end_time} ({scheduleForm.shift_name})</p>
              <p className="text-muted-foreground">💾 Tras guardar puedes agregar otro bloque sin cerrar este diálogo.</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saveScheduleMutation.isPending || scheduleForm.days.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Agregar Bloque
              </Button>
              <Button type="button" variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cerrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>


      {/* Account creation dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Crear Cuenta — {staff.find((s: any) => s.id === accountStaffId)?.full_name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createAccountMutation.mutate(); }} className="space-y-4">
            <div>
              <Label>Email de acceso *</Label>
              <Input
                type="email"
                required
                value={accountForm.email}
                onChange={e => setAccountForm({ ...accountForm, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
              <p className="text-xs text-muted-foreground mt-1">El personal usará este email para iniciar sesión</p>
            </div>
            <div>
              <Label>Contraseña *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={accountForm.password}
                  onChange={e => setAccountForm({ ...accountForm, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Comparte esta contraseña con el personal de forma segura</p>
            </div>
            <div>
              <Label>Rol en el sistema</Label>
              <Select value={accountForm.role} onValueChange={v => setAccountForm({ ...accountForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderator">🛡️ Moderador (acceso al panel según permisos)</SelectItem>
                  <SelectItem value="user">👤 Usuario (acceso mínimo: asistencia)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Luego puedes configurar los permisos específicos en el Panel de Permisos</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold text-primary">📋 Resumen</p>
              <p className="text-xs text-muted-foreground">• Se creará una cuenta con email confirmado</p>
              <p className="text-xs text-muted-foreground">• Se vinculará automáticamente al registro de personal</p>
              <p className="text-xs text-muted-foreground">• El personal podrá iniciar sesión inmediatamente</p>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={createAccountMutation.isPending || !accountForm.email || !accountForm.password}>
              <KeyRound className="h-4 w-4" />
              {createAccountMutation.isPending ? "Creando cuenta..." : "Crear Cuenta y Vincular"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffPage;
