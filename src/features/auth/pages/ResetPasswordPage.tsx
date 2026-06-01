import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logoDark from "@/assets/logo-dark-theme.png";
import { resetPasswordSchema } from "@/lib/sanitize";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      toast.error("Enlace inválido");
      navigate("/login");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("¡Contraseña actualizada!");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          <img src={logoDark} alt="INFOCOM" className="h-16 object-contain mx-auto" />
          <CardTitle className="font-display text-2xl">Nueva Contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value.slice(0, 72))} maxLength={72} autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label>Confirmar contraseña</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value.slice(0, 72))} maxLength={72} autoComplete="new-password" required />
            </div>
            <Button type="submit" className="w-full glow-green-sm" disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar Contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
