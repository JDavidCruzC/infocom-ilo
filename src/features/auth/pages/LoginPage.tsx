import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff } from "lucide-react";
import logoDark from "@/assets/logo-dark-theme.png";
import { loginSchema, sanitizeEmail, sanitizeText } from "@/lib/sanitize";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sanitización + validación con zod
    const parsed = loginSchema.safeParse({
      email: sanitizeEmail(email),
      password: sanitizeText(password, { maxLength: 72 }),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciales incorrectas" : error.message);
      return;
    }

    let nextPath = "/cuenta";
    if (data.user?.id) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      const canEnterAdminPanel = (roleRows || []).some((row: any) => ["admin", "moderator", "user", "terminal"].includes(row.role));
      if (canEnterAdminPanel) nextPath = "/admin";
    }

    toast.success("¡Bienvenido!");
    navigate(nextPath);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <Card className="w-full max-w-md relative border-primary/20 bg-card/95 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={logoDark} alt="INFOCOM" className="h-16 object-contain mx-auto" />
          </div>
          <CardTitle className="font-display text-2xl">Iniciar Sesión</CardTitle>
          <CardDescription>Ingresa a tu cuenta INFOCOM</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
                maxLength={254}
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 72))}
                  maxLength={72}
                  autoComplete="current-password"
                  required
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
            </div>
            <Button type="submit" className="w-full glow-green-sm" disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Ingresando..." : "Iniciar Sesión"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="text-primary hover:underline font-medium">Regístrate aquí</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
