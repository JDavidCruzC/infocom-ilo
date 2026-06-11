import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Save, Trash2, Star, FileText, Loader2, Eye, Printer } from "lucide-react";
import { toast } from "sonner";
import { RichEditor, renderTemplateHtml, printHtml } from "./RichEditor";
import { TEMPLATE_KINDS, RECEIPT_BLOCKS } from "./receiptTemplateDefaults";

type Tpl = {
  id: string;
  kind: string;
  name: string;
  content_html: string;
  paper_size: "a4" | "ticket_80mm";
  is_default: boolean;
};

const SAMPLE_DATA: Record<string, any> = {
  empresa: { nombre: "INFOCOM SOLUCIONES", ruc: "10479533852", direccion: "24 de Octubre Mz 53 Lt 03", ciudad: "Ilo - Moquegua", telefono: "963326971", email: "infocomcotizaciones@gmail.com", web: "www.infocomilo.com" },
  comprobante: { titulo: "BOLETA DE VENTA", numero: "000123", fecha: "11/06/2026", hora: "14:30" },
  cliente: { nombre: "JUAN PÉREZ GARCÍA", documento: "12345678", telefono: "987654321", direccion: "Av. Ejemplo 123" },
  items_tabla: `<table><thead><tr><th>Cant</th><th>Descripción</th><th>P. Unit</th><th>Subtotal</th></tr></thead><tbody><tr><td>1</td><td>Mouse gamer RGB</td><td>S/ 45.00</td><td>S/ 45.00</td></tr><tr><td>2</td><td>Teclado mecánico</td><td>S/ 120.00</td><td>S/ 240.00</td></tr></tbody></table>`,
  totales: { subtotal: "241.53", igv: "43.47", total: "285.00", total_letras: "DOSCIENTOS OCHENTA Y CINCO CON 00/100 SOLES" },
  vendedor: { nombre: "Carlos Mamani" },
  pago: { metodo: "Efectivo", recibido: "300.00", vuelto: "15.00" },
  notas: "",
  orden: { numero: "REC-000045", fecha: "11/06/2026", fecha_estimada: "15/06/2026" },
  equipo: { tipo: "Laptop", marca: "HP", modelo: "Pavilion 15", serie: "ABC123XYZ", accesorios: "Cargador, mochila", estado: "Bueno, sin golpes" },
  falla: { reportada: "No enciende, hace pitidos al presionar el botón de encendido" },
  diagnostico: "",
  tecnico: { nombre: "Luis Quispe" },
  costo: { estimado: "120.00" },
};

export default function ReceiptTemplateManager() {
  const qc = useQueryClient();
  const [selectedKind, setSelectedKind] = useState<string>(TEMPLATE_KINDS[0].value);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [previewing, setPreviewing] = useState<Tpl | null>(null);

  const kindDef = TEMPLATE_KINDS.find(k => k.value === selectedKind)!;

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["receipt_templates", selectedKind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_templates")
        .select("id, kind, name, content_html, paper_size, is_default")
        .eq("kind", selectedKind)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Tpl[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (tpl: Tpl) => {
      if (tpl.is_default) {
        await supabase.from("receipt_templates").update({ is_default: false }).eq("kind", tpl.kind);
      }
      if (tpl.id) {
        const { error } = await supabase.from("receipt_templates").update({
          name: tpl.name, content_html: tpl.content_html, paper_size: tpl.paper_size, is_default: tpl.is_default,
        }).eq("id", tpl.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("receipt_templates").insert({
          kind: tpl.kind, name: tpl.name, content_html: tpl.content_html, paper_size: tpl.paper_size, is_default: tpl.is_default,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("✅ Plantilla guardada");
      qc.invalidateQueries({ queryKey: ["receipt_templates"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("receipt_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plantilla eliminada");
      qc.invalidateQueries({ queryKey: ["receipt_templates"] });
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("receipt_templates").update({ is_default: false }).eq("kind", selectedKind);
      await supabase.from("receipt_templates").update({ is_default: true }).eq("id", id);
    },
    onSuccess: () => {
      toast.success("⭐ Plantilla por defecto actualizada");
      qc.invalidateQueries({ queryKey: ["receipt_templates"] });
    },
  });

  const startNew = () => {
    setEditing({
      id: "",
      kind: selectedKind,
      name: `Plantilla ${kindDef.label}`,
      content_html: kindDef.defaultHtml,
      paper_size: "a4",
      is_default: templates.length === 0,
    });
  };

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Editor Visual de Comprobantes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Diseñá tus tickets como en Google Docs: colores, fuentes, tablas, imágenes, logos y variables dinámicas. La plantilla marcada como ⭐ se usa por defecto al imprimir.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[250px]">
            <Label className="text-xs">Tipo de comprobante</Label>
            <Select value={selectedKind} onValueChange={setSelectedKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_KINDS.map(k => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" /> Nueva plantilla</Button>
        </div>

        <div className="space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
          {!isLoading && templates.length === 0 && (
            <div className="rounded-lg border border-dashed border-primary/30 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">No hay plantillas para este tipo todavía.</p>
              <Button variant="outline" size="sm" onClick={startNew} className="gap-2"><Plus className="h-3.5 w-3.5" /> Crear primera plantilla</Button>
            </div>
          )}
          {templates.map(tpl => (
            <div key={tpl.id} className="flex items-center gap-2 rounded-md border border-primary/20 bg-card p-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{tpl.name}</span>
                  {tpl.is_default && <Badge variant="default" className="h-5 text-[10px] gap-1"><Star className="h-2.5 w-2.5" /> Por defecto</Badge>}
                  <Badge variant="outline" className="h-5 text-[10px]">{tpl.paper_size === "a4" ? "A4" : "Ticket 80mm"}</Badge>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPreviewing(tpl)}><Eye className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(tpl)}>Editar</Button>
              {!tpl.is_default && (
                <Button size="sm" variant="ghost" onClick={() => setDefaultMutation.mutate(tpl.id)} title="Marcar como predeterminada">
                  <Star className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Eliminar "${tpl.name}"?`)) deleteMutation.mutate(tpl.id); }}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editor de plantilla — {kindDef.label}</DialogTitle>
            <DialogDescription>
              Diseñá libremente. Usá <strong>Variables</strong> para insertar datos dinámicos y <strong>Bloques</strong> para secciones pre-hechas.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Nombre de la plantilla</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Tamaño de papel</Label>
                  <Select value={editing.paper_size} onValueChange={(v: any) => setEditing({ ...editing, paper_size: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 (hoja completa)</SelectItem>
                      <SelectItem value="ticket_80mm">Ticket térmico 80mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <RichEditor
                value={editing.content_html}
                onChange={(html) => setEditing({ ...editing, content_html: html })}
                variables={kindDef.variables}
                blocks={RECEIPT_BLOCKS}
                minHeight={500}
              />

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editing.is_default}
                  onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })}
                  id="is_default"
                />
                <label htmlFor="is_default">Marcar como plantilla por defecto para {kindDef.label}</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && printHtml(renderTemplateHtml(editing.content_html, SAMPLE_DATA), { title: editing.name, paper: editing.paper_size })}
              variant="secondary"
              className="gap-2"
            >
              <Printer className="h-4 w-4" /> Vista previa de impresión
            </Button>
            <Button onClick={() => editing && saveMutation.mutate(editing)} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa — {previewing?.name}</DialogTitle>
            <DialogDescription>Con datos de ejemplo. Para imprimir con datos reales usá el botón "Imprimir personalizado" desde el ticket.</DialogDescription>
          </DialogHeader>
          {previewing && (
            <div className="rounded-lg border bg-white text-black p-6" dangerouslySetInnerHTML={{ __html: renderTemplateHtml(previewing.content_html, SAMPLE_DATA) }} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewing(null)}>Cerrar</Button>
            <Button onClick={() => previewing && printHtml(renderTemplateHtml(previewing.content_html, SAMPLE_DATA), { title: previewing.name, paper: previewing.paper_size })} className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir muestra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
