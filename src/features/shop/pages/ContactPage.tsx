import Header from "@/features/shop/components/Header";
import Footer from "@/features/shop/components/Footer";
import WhatsAppButton from "@/features/shop/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_ADDRESS, WHATSAPP_NUMBER } from "@/lib/types";
import { Mail, Phone, MapPin, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { sanitizeText, sanitizeEmail, fullNameSchema, emailSchema, messageSchema } from "@/lib/sanitize";

const ContactPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = fullNameSchema.safeParse(name);
    const em = emailSchema.safeParse(email);
    const ms = messageSchema.safeParse(message);
    if (!n.success) return toast.error(n.error.issues[0].message);
    if (!em.success) return toast.error(em.error.issues[0].message);
    if (!ms.success) return toast.error(ms.error.issues[0].message);
    const msg = `Hola, soy ${n.data} (${em.data}). ${ms.data}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success("Redirigiendo a WhatsApp...");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-center mb-2">Contáctanos</h1>
        <p className="text-center text-muted-foreground mb-10">Estamos aquí para ayudarte</p>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-card rounded-xl border border-primary/10">
              <Phone className="h-5 w-5 text-primary mt-1 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Teléfono</h3>
                <p className="text-sm text-muted-foreground">{COMPANY_PHONE}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-card rounded-xl border border-primary/10">
              <Mail className="h-5 w-5 text-primary mt-1 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Email</h3>
                <p className="text-sm text-muted-foreground">{COMPANY_EMAIL}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-card rounded-xl border border-primary/10">
              <MapPin className="h-5 w-5 text-primary mt-1 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Dirección</h3>
                <p className="text-sm text-muted-foreground">{COMPANY_ADDRESS}</p>
              </div>
            </div>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2 glow-green-sm" size="lg">
                <MessageCircle className="h-5 w-5" /> Chat por WhatsApp
              </Button>
            </a>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-card rounded-xl border border-primary/10">
            <h2 className="font-display font-bold text-lg">Envíanos un mensaje</h2>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(sanitizeText(e.target.value, { maxLength: 80 }))} maxLength={80} required placeholder="Tu nombre" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(sanitizeEmail(e.target.value))} maxLength={254} required placeholder="tu@correo.com" />
            </div>
            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea value={message} onChange={(e) => setMessage(sanitizeText(e.target.value, { maxLength: 2000, preserveNewlines: true }))} maxLength={2000} required placeholder="¿En qué podemos ayudarte?" rows={4} />
            </div>
            <Button type="submit" className="w-full gap-2"><Send className="h-4 w-4" /> Enviar por WhatsApp</Button>
          </form>
        </div>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default ContactPage;
