import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Sparkles } from "lucide-react";
import { RichEditor, renderTemplateHtml, printHtml } from "./RichEditor";
import { TEMPLATE_KINDS, DEFAULT_RECEIPT_HTML, DEFAULT_RECEPCION_HTML } from "./receiptTemplateDefaults";
import { DOCUMENT_KINDS } from "./PrintReceipt";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  source: "transaction" | "service_order";
  sourceId: string;
  /** For transactions: the tipo_comprobante (e.g. "boleta"). Ignored for service orders. */
  kind?: string;
}

export default function CustomPrintDialog({ open, onClose, source, sourceId, kind }: Props) {
  const tplKind = source === "service_order" ? "recepcion_servicio" : (kind || "boleta");
  const kindDef = useMemo(() => TEMPLATE_KINDS.find(k => k.value === tplKind) || TEMPLATE_KINDS[0], [tplKind]);

  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState("");
  const [data, setData] = useState<Record<string, any>>({});
  const [paper, setPaper] = useState<"a4" | "ticket_80mm">("a4");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        // 1. Get default template (or fallback HTML)
        const { data: tpls } = await supabase
          .from("receipt_templates")
          .select("content_html, paper_size, is_default")
          .eq("kind", tplKind)
          .order("is_default", { ascending: false })
          .limit(1);
        const tpl = tpls?.[0];
        const baseHtml = tpl?.content_html || (source === "service_order" ? DEFAULT_RECEPCION_HTML : DEFAULT_RECEIPT_HTML);
        setPaper((tpl?.paper_size as any) || "a4");

        // 2. Get company info
        const { data: ci } = await supabase
          .from("store_settings").select("value").eq("key", "receipt_company_info").maybeSingle();
        const empresa = (ci?.value as any) || {};

        // 3. Build data
        let built: Record<string, any> = {
          empresa: {
            nombre: empresa.copyright || "INFOCOM SOLUCIONES",
            ruc: empresa.ruc || "",
            direccion: empresa.direccion || "",
            ciudad: empresa.ciudad || "",
            telefono: empresa.telefono || "",
            email: empresa.email || "",
            web: empresa.web || "",
          },
          notas: "",
        };

        if (source === "transaction") {
          const { data: tx } = await supabase
            .from("transactions")
            .select("id, fecha, cliente_nombre, cliente_documento, cliente_telefono, tipo_comprobante, numero_comprobante, ticket_number, total, subtotal_productos, subtotal_servicios, metodo_pago, emitido_por, notas")
            .eq("id", sourceId).maybeSingle();
          const { data: items } = await supabase
            .from("transaction_items").select("descripcion, cantidad, precio_unitario, subtotal, item_type").eq("transaction_id", sourceId);

          const kindDoc = DOCUMENT_KINDS.find(d => d.value === tx?.tipo_comprobante);
          const fecha = tx?.fecha ? new Date(tx.fecha) : new Date();
          const total = Number(tx?.total || 0);
          const sub = total / 1.18;
          const igv = total - sub;
          const itemsRows = (items || []).map(it =>
            `<tr><td style="text-align:center">${it.cantidad}</td><td>${escapeHtml(it.descripcion || "")}</td><td style="text-align:right">S/ ${Number(it.precio_unitario || 0).toFixed(2)}</td><td style="text-align:right">S/ ${Number(it.subtotal || 0).toFixed(2)}</td></tr>`
          ).join("");
          const itemsTabla = `<table><thead><tr><th>Cant</th><th>Descripción</th><th>P. Unit</th><th>Subtotal</th></tr></thead><tbody>${itemsRows || '<tr><td colspan="4" style="text-align:center">Sin items</td></tr>'}</tbody></table>`;

          built = {
            ...built,
            comprobante: {
              titulo: (kindDoc?.label || "COMPROBANTE").toUpperCase(),
              numero: tx?.numero_comprobante || tx?.ticket_number || "------",
              fecha: fecha.toLocaleDateString("es-PE"),
              hora: fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
            },
            cliente: {
              nombre: tx?.cliente_nombre || "—",
              documento: tx?.cliente_documento || "",
              telefono: tx?.cliente_telefono || "",
              direccion: "",
            },
            items_tabla: itemsTabla,
            totales: { subtotal: sub.toFixed(2), igv: igv.toFixed(2), total: total.toFixed(2), total_letras: "" },
            vendedor: { nombre: tx?.emitido_por || "" },
            pago: { metodo: tx?.metodo_pago || "Efectivo", recibido: "", vuelto: "" },
            notas: tx?.notas || "",
          };
        } else {
          const { data: so } = await supabase
            .from("service_orders").select("*").eq("id", sourceId).maybeSingle();
          const fecha = so?.created_at ? new Date(so.created_at) : new Date();
          built = {
            ...built,
            orden: {
              numero: so?.order_number || so?.id?.slice(0, 8) || "—",
              fecha: fecha.toLocaleDateString("es-PE"),
              fecha_estimada: so?.estimated_delivery ? new Date(so.estimated_delivery).toLocaleDateString("es-PE") : "—",
            },
            cliente: {
              nombre: so?.customer_name || "—",
              documento: so?.customer_dni || "",
              telefono: so?.customer_phone || "",
              direccion: "",
            },
            equipo: {
              tipo: so?.device_type || "",
              marca: so?.device_brand || "",
              modelo: so?.device_model || "",
              serie: so?.serial_number || "",
              accesorios: so?.accessories || "",
              estado: so?.device_condition || "",
            },
            falla: { reportada: so?.reported_issue || "" },
            diagnostico: so?.diagnosis || "",
            tecnico: { nombre: so?.assigned_technician || "" },
            costo: { estimado: Number(so?.estimated_cost || 0).toFixed(2) },
            notas: so?.notes || "",
          };
        }

        setData(built);
        setHtml(renderTemplateHtml(baseHtml, built));
      } catch (e: any) {
        toast.error("Error cargando datos: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, source, sourceId, tplKind]);

  const doPrint = () => {
    // Re-render any remaining {{vars}} the user may have inserted while editing
    printHtml(renderTemplateHtml(html, data), { title: "Comprobante", paper });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Personalizar e imprimir
          </DialogTitle>
          <DialogDescription>
            Editá libremente este comprobante antes de imprimirlo. Los datos del cliente y los items ya están cargados.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <RichEditor
            value={html}
            onChange={setHtml}
            variables={kindDef.variables}
            minHeight={520}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={doPrint} disabled={loading} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
