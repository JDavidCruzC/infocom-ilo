import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";
import { Shield, Lock } from "lucide-react";
import { ALL_MODULES } from "@/features/auth/hooks/usePermissions";

const GROUPS = [...new Set(ALL_MODULES.map(m => m.group))];

const getIcon = (name: string) => {
  const Ico = (LucideIcons as any)[name];
  return Ico || Shield;
};

const PermissionsConfigPage = () => {
  const qc = useQueryClient();
  const [activeRole, setActiveRole] = useState<string>("moderator");

  const { data: roleList = [] } = useQuery({
    queryKey: ["role_metadata"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_metadata")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["role_permissions_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .order("module");
      if (error) throw error;
      return data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ role, module, can_access }: { role: string; module: string; can_access: boolean }) => {
      const existing = permissions.find((p: any) => p.role === role && p.module === module);
      if (existing) {
        const { error } = await supabase
          .from("role_permissions")
          .update({ can_access, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role: role as any, module, can_access });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role_permissions_all"] });
      qc.invalidateQueries({ queryKey: ["role_permissions"] });
      toast.success("Permiso actualizado");
    },
    onError: (e: any) => toast.error(e.message || "Error al actualizar permiso"),
  });

  const getAccess = (role: string, module: string) => {
    const p = permissions.find((p: any) => p.role === role && p.module === module);
    return p?.can_access ?? false;
  };

  const enabledCount = (role: string) =>
    role === "admin"
      ? ALL_MODULES.length
      : ALL_MODULES.filter(m => getAccess(role, m.key)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Lock className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold">Panel de Permisos</h1>
          <p className="text-sm text-muted-foreground">Configura el acceso a cada módulo por rol. Los roles personalizados creados desde "Roles" aparecen aquí automáticamente.</p>
        </div>
      </div>

      {roleList.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
      <Tabs value={activeRole} onValueChange={setActiveRole}>
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
          {roleList.map((r: any) => {
            const Ico = getIcon(r.icon);
            return (
              <TabsTrigger key={r.role_key} value={r.role_key} className="gap-2 text-xs sm:text-sm">
                <Ico className="h-4 w-4" />
                <span className="hidden sm:inline">{r.label}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">{enabledCount(r.role_key)}/{ALL_MODULES.length}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {roleList.map((r: any) => {
          const Ico = getIcon(r.icon);
          const roleKey = r.role_key;
          return (
          <TabsContent key={roleKey} value={roleKey} className="mt-4 space-y-4">
            <Card className="border-primary/10">
              <CardContent className="p-4 flex items-center gap-3">
                <Ico className={`h-8 w-8 ${r.color || "text-primary"}`} />
                <div>
                  <p className="font-bold flex items-center gap-2">
                    {r.label}
                    {!r.is_system && <Badge variant="outline" className="text-[10px]">Personalizado</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                </div>
                {roleKey === "admin" && (
                  <Badge className="ml-auto bg-destructive/20 text-destructive border-destructive/30">Acceso Total</Badge>
                )}
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {GROUPS.map(group => {
                  const modules = ALL_MODULES.filter(m => m.group === group);
                  return (
                    <Card key={group} className="border-primary/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-1">
                        {modules.map(mod => {
                          const isOn = roleKey === "admin" ? true : getAccess(roleKey, mod.key);
                          const isAdminRow = roleKey === "admin";
                          return (
                            <div
                              key={mod.key}
                              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                                isOn ? "bg-primary/5 border border-primary/20" : "bg-muted/30 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{mod.icon}</span>
                                <div>
                                  <p className="font-medium text-sm">{mod.label}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono">{mod.key}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${isOn ? "bg-primary/20 text-primary border-primary/30" : "bg-muted text-muted-foreground"}`}
                                >
                                  {isOn ? "Activo" : "Bloqueado"}
                                </Badge>
                                <Switch
                                  checked={isOn}
                                  disabled={isAdminRow || toggleMutation.isPending}
                                  onCheckedChange={(checked) =>
                                    toggleMutation.mutate({ role: roleKey, module: mod.key, can_access: checked })
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
          );
        })}
      </Tabs>
      )}
    </div>
  );
};

export default PermissionsConfigPage;
