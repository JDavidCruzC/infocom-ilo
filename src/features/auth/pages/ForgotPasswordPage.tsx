import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";
import logoDark from "@/assets/logo-dark-theme.png";
import { emailSchema, sanitizeEmail } from "@/lib/sanitize";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(sanitizeEmail(email));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Correo no válido");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("¡Correo enviado! Revisa tu bandeja de entrada.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <Card className="w-full max-w-md relative border-primary/20 bg-card/95 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          <img src={logoDark} alt="INFOCOM" className="h-16 object-contain mx-auto" />
          <CardTitle className="font-display text-2xl">Recuperar Contraseña</CardTitle>
          <CardDescription>Te enviaremos un enlace para restablecer tu contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <Mail className="h-12 w-12 text-primary mx-auto" />
              <p className="text-muted-foreground">Hemos enviado un enlace a <strong>{email}</strong>. Revisa tu correo.</p>
              <Link to="/login"><Button variant="outline" className="w-full"><ArrowLeft className="h-4 w-4 mr-2" /> Volver al login</Button></Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(sanitizeEmail(e.target.value))} maxLength={254} autoComplete="email" required />
              </div>
              <Button type="submit" className="w-full glow-green-sm" disabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
              <Link to="/login" className="block text-center text-sm text-primary hover:underline">
                <ArrowLeft className="h-3 w-3 inline mr-1" /> Volver al login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
