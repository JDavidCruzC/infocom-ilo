import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Plus, Search, UserCheck, UserX, Crown, Monitor } from "lucide-react";

const ROLE_MAP: Record<string, { label: string; color: string; icon: any }> = {
  admin: { label: "Administrador", color: "bg-destructive/20 text-destructive border-destructive/30", icon: Crown },
  moderator: { label: "Moderador", color: "bg-warning/20 text-warning border-warning/30", icon: Shield },
  terminal: { label: "Terminal Tienda", color: "bg-accent/20 text-accent border-accent/30", icon: Monitor },
  user: { label: "Usuario", color: "bg-primary/20 text-primary border-primary/30", icon: UserCheck },
};

const RolesPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("moderator");

  const { data: roleMetadata = [] } = useQuery({
    queryKey: ["role_metadata"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_metadata").select("*").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_create_role", {
        _key: newRoleKey, _label: newRoleLabel, _icon: "Shield",
        _color: "text-primary", _description: newRoleDesc || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ Rol creado. Configura sus permisos en el panel de Permisos.");
      queryClient.invalidateQueries({ queryKey: ["role_metadata"] });
      setCreateOpen(false);
      setNewRoleKey(""); setNewRoleLabel(""); setNewRoleDesc("");
    },
    onError: (e: any) => toast.error(e.message || "Error al crear rol"),
  });


  // Fetch profiles to show names
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["profiles_map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone");
      const m: Record<string, { name: string; phone: string | null }> = {};
      (data || []).forEach((p: any) => {
        if (p.user_id) m[p.user_id] = { name: p.full_name || "Sin nombre", phone: p.phone };
      });
      return m;
    },
  });

  // Fetch staff to detect employees vs clients
  const { data: staffUserIds = [] } = useQuery({
    queryKey: ["staff_user_ids"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_members").select("user_id").not("user_id", "is", null);
      return (data || []).map((s: any) => s.user_id).filter(Boolean);
    },
  });

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      toast.success("Rol asignado correctamente");
      setDialogOpen(false);
      setNewUserId("");
    },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Este usuario ya tiene ese rol" : "Error al asignar rol"),
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      toast.success("Rol removido");
    },
  });

  const getUserLabel = (userId: string) => {
    const profile = profilesMap[userId];
    const isStaff = staffUserIds.includes(userId);
    return {
      name: profile?.name || "Usuario sin perfil",
      badge: isStaff ? "Personal" : "Cliente",
      badgeColor: isStaff ? "bg-primary/20 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border",
    };
  };

  const filtered = roles.filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const profile = profilesMap[r.user_id];
    return r.user_id?.toLowerCase().includes(s) ||
      r.role?.includes(s) ||
      profile?.name?.toLowerCase().includes(s);
  });

  const adminCount = roles.filter((r: any) => r.role === "admin").length;
  const modCount = roles.filter((r: any) => r.role === "moderator").length;

  // Build list of users for the assign dialog
  const allUserOptions = Object.entries(profilesMap).map(([uid, info]) => ({
    uid,
    name: info.name,
    isStaff: staffUserIds.includes(uid),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Gestión de Roles
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Asignar Rol</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Asignar Rol a Usuario</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); addRoleMutation.mutate({ userId: newUserId, role: newRole }); }} className="space-y-4">
              <div>
                <Label>Usuario</Label>
                {allUserOptions.length > 0 ? (
                  <Select value={newUserId} onValueChange={setNewUserId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar usuario..." /></SelectTrigger>
                    <SelectContent>
                      {allUserOptions.map(u => (
                        <SelectItem key={u.uid} value={u.uid}>
                          {u.name} {u.isStaff ? "(Personal)" : "(Cliente)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input required value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="UUID del usuario" className="font-mono text-xs" />
                )}
                <p className="text-xs text-muted-foreground mt-1">Selecciona el usuario al que deseas asignar un rol</p>
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">👑 Administrador</SelectItem>
                    <SelectItem value="moderator">🛡️ Moderador (Recepcionista/Técnico)</SelectItem>
                    <SelectItem value="terminal">🖥️ Terminal Tienda (Vendedor/Marcado)</SelectItem>
                    <SelectItem value="user">👤 Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={addRoleMutation.isPending || !newUserId}>Asignar Rol</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-destructive/20"><CardContent className="p-4 text-center"><Crown className="h-5 w-5 mx-auto mb-1 text-destructive" /><p className="text-2xl font-bold">{adminCount}</p><p className="text-xs text-muted-foreground">Admins</p></CardContent></Card>
        <Card className="border-warning/20"><CardContent className="p-4 text-center"><Shield className="h-5 w-5 mx-auto mb-1 text-warning" /><p className="text-2xl font-bold">{modCount}</p><p className="text-xs text-muted-foreground">Moderadores</p></CardContent></Card>
        <Card className="border-primary/20"><CardContent className="p-4 text-center"><UserCheck className="h-5 w-5 mx-auto mb-1 text-primary" /><p className="text-2xl font-bold">{roles.length}</p><p className="text-xs text-muted-foreground">Total Roles</p></CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, ID o rol..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Roles list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-primary/20"><CardContent className="py-12 text-center text-muted-foreground"><Shield className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No hay roles asignados</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r: any) => {
            const rm = ROLE_MAP[r.role] || ROLE_MAP.user;
            const RIcon = rm.icon;
            const userInfo = getUserLabel(r.user_id);
            return (
              <Card key={r.id} className="border-primary/10">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <RIcon className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{userInfo.name}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${userInfo.badgeColor}`}>{userInfo.badge}</Badge>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">{r.user_id}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("es-PE")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${rm.color}`}>{rm.label}</Badge>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => removeRoleMutation.mutate(r.id)}>
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RolesPage;
