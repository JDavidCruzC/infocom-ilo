import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import logoDark from "@/assets/logo-dark-theme.png";
import { registerSchema, sanitizeEmail, sanitizeText } from "@/lib/sanitize";

const RegisterPage = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = registerSchema.safeParse({
      fullName: sanitizeText(fullName, { maxLength: 80 }),
      email: sanitizeEmail(email),
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("¡Registro exitoso! Revisa tu correo para confirmar tu cuenta.");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <Card className="w-full max-w-md relative border-primary/20 bg-card/95 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={logoDark} alt="INFOCOM" className="h-16 object-contain mx-auto" />
          </div>
          <CardTitle className="font-display text-2xl">Crear Cuenta</CardTitle>
          <CardDescription>Únete a INFOCOM TECNOLOGY</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                placeholder="Juan Pérez"
                value={fullName}
                onChange={(e) => setFullName(sanitizeText(e.target.value, { maxLength: 80 }))}
                maxLength={80}
                autoComplete="name"
                required
              />
            </div>
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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8, letras + números"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 72))}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.slice(0, 72))}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full glow-green-sm" disabled={loading}>
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? "Registrando..." : "Crear Cuenta"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Inicia sesión</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
