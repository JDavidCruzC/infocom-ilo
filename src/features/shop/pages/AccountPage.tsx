import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/features/shop/components/Header";
import Footer from "@/features/shop/components/Footer";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CURRENCY, ORDER_STATUS_LABELS } from "@/lib/types";
import type { Order } from "@/lib/types";
import { User, Package, LogOut, Settings, Lock, Save, Eye, EyeOff, Mail, Phone, MapPin, Shield } from "lucide-react";
import { toast } from "sonner";

const AccountPage = () => {
  const { user, signOut, roles } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile state
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    department: "",
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Fetch orders
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders((data || []) as Order[]);
        setLoading(false);
      });

    // Fetch profile
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile({
            full_name: data.full_name || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            department: data.department || "",
          });
        }
        setProfileLoading(false);
      });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sesión cerrada");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Check if profile exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: profile.full_name || null,
            phone: profile.phone || null,
            address: profile.address || null,
            city: profile.city || null,
            department: profile.department || null,
          })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            full_name: profile.full_name || null,
            phone: profile.phone || null,
            address: profile.address || null,
            city: profile.city || null,
            department: profile.department || null,
          });
        if (error) throw error;
      }
      toast.success("Perfil actualizado correctamente");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      toast.success("Contraseña actualizada correctamente");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar contraseña");
    } finally {
      setChangingPw(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center">
          <p className="mb-4">Debes iniciar sesión</p>
          <Link to="/login"><Button>Iniciar Sesión</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    confirmed: "bg-info/20 text-info",
    processing: "bg-primary/20 text-primary",
    shipped: "bg-accent/20 text-accent-foreground",
    delivered: "bg-success/20 text-success",
    cancelled: "bg-destructive/20 text-destructive",
  };

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    moderator: "Moderador",
    terminal: "Terminal Tienda",
    user: "Usuario",
  };

  const canAccessAdminPanel = roles.some(role => ["admin", "moderator", "user", "terminal"].includes(role));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 sm:py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold">Mi Cuenta</h1>
          <div className="flex gap-2">
            {canAccessAdminPanel && <Link to="/admin"><Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1" /> Panel</Button></Link>}
            <Button variant="outline" size="sm" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-1" /> Salir</Button>
          </div>
        </div>

        <Tabs defaultValue="perfil" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="perfil" className="gap-1"><User className="h-4 w-4" /> Perfil</TabsTrigger>
            <TabsTrigger value="seguridad" className="gap-1"><Lock className="h-4 w-4" /> Seguridad</TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-1"><Package className="h-4 w-4" /> Pedidos</TabsTrigger>
          </TabsList>

          {/* ─── PERFIL ─── */}
          <TabsContent value="perfil">
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" /> Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Account info (read-only) */}
                <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Roles:</span>
                    <div className="flex gap-1">
                      {roles.length > 0 ? roles.map(r => (
                        <Badge key={r} variant="outline" className="text-xs">{roleLabels[r] || r}</Badge>
                      )) : (
                        <Badge variant="outline" className="text-xs">Cliente</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Miembro desde {new Date(user.created_at).toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>

                {/* Editable profile */}
                {profileLoading ? (
                  <div className="flex justify-center py-8"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Nombre Completo</Label>
                        <Input
                          value={profile.full_name}
                          onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                          placeholder="Tu nombre completo"
                        />
                      </div>
                      <div>
                        <Label>Teléfono</Label>
                        <Input
                          value={profile.phone}
                          onChange={e => setProfile({ ...profile, phone: e.target.value })}
                          placeholder="+51 999 999 999"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Dirección</Label>
                      <Input
                        value={profile.address}
                        onChange={e => setProfile({ ...profile, address: e.target.value })}
                        placeholder="Tu dirección de envío"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Ciudad</Label>
                        <Input
                          value={profile.city}
                          onChange={e => setProfile({ ...profile, city: e.target.value })}
                          placeholder="Ilo"
                        />
                      </div>
                      <div>
                        <Label>Departamento</Label>
                        <Input
                          value={profile.department}
                          onChange={e => setProfile({ ...profile, department: e.target.value })}
                          placeholder="Moquegua"
                        />
                      </div>
                    </div>
                    <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                      <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── SEGURIDAD ─── */}
          <TabsContent value="seguridad">
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-primary" /> Cambiar Contraseña
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <p className="text-sm text-muted-foreground">
                  Ingresa tu nueva contraseña. Debe tener al menos 6 caracteres.
                </p>
                <div>
                  <Label>Nueva Contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      value={passwords.new}
                      onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPw(!showPw)}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Confirmar Contraseña</Label>
                  <Input
                    type={showPw ? "text" : "password"}
                    value={passwords.confirm}
                    onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                    placeholder="••••••••"
                  />
                  {passwords.confirm && passwords.new !== passwords.confirm && (
                    <p className="text-xs text-destructive mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPw || !passwords.new || passwords.new !== passwords.confirm}
                  className="gap-2"
                >
                  <Lock className="h-4 w-4" /> {changingPw ? "Cambiando..." : "Cambiar Contraseña"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── PEDIDOS ─── */}
          <TabsContent value="pedidos">
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-primary" /> Mis Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No tienes pedidos aún</p>
                    <Link to="/catalogo"><Button variant="outline" className="mt-4">Ver Catálogo</Button></Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-secondary/30 rounded-lg">
                        <div>
                          <p className="font-medium">{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at!).toLocaleDateString("es-PE")}</p>
                        </div>
                        <Badge className={statusColors[order.status] || ""}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                        <span className="font-bold text-primary">{CURRENCY}{Number(order.total).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default AccountPage;
