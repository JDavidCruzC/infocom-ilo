import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, FileText, FolderArchive, Download, Loader2, Receipt, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DOCUMENT_KINDS, DocumentKind, buildA4SaleHtml, loadTemplateFromDb, loadCompanyInfo } from "./PrintReceipt";
import CustomPrintDialog from "./CustomPrintDialog";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Props {
  isAdmin: boolean;
}

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function ComprobantesDrawer({ isAdmin }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ kind: DocumentKind; label: string; value: number } | null>(null);
  const [newValue, setNewValue] = useState("");
  const [customPrint, setCustomPrint] = useState<{ id: string; kind: string } | null>(null);

  const today = new Date();
  const [mode, setMode] = useState<"month" | "range">("month");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10));
  const [to, setTo] = useState(today.toISOString().slice(0,10));
  const [kindFilter, setKindFilter] = useState<string>("todos");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const { fromDate, toDate } = useMemo(() => {
    if (mode === "month") {
      const f = new Date(year, month, 1);
      const t = new Date(year, month + 1, 0, 23, 59, 59);
      return { fromDate: f.toISOString().slice(0,10), toDate: t.toISOString().slice(0,10) };
    }
    return { fromDate: from, toDate: to };
  }, [mode, year, month, from, to]);

  const { data: counters = {} } = useQuery({
    queryKey: ["comprobante_counters"],
    queryFn: async () => {
      const { data } = await supabase.from("store_settings").select("value").eq("key", "comprobante_counters").maybeSingle();
      return (data?.value as Record<string, number>) || {};
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["comprobante_counts_by_kind"],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("tipo_comprobante").not("tipo_comprobante", "is", null);
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const k = r.tipo_comprobante as string;
        map[k] = (map[k] || 0) + 1;
      });
      return map;
    },
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["comprobantes_for_zip", fromDate, toDate, kindFilter, clientFilter],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("transactions")
        .select("id, fecha, cliente_nombre, cliente_telefono, tipo_comprobante, numero_comprobante, ticket_number, total, subtotal_productos, subtotal_servicios, estado, emitido_por")
        .eq("estado", "emitido")
        .not("tipo_comprobante", "is", null)
        .gte("fecha", fromDate)
        .lte("fecha", toDate)
        .order("fecha", { ascending: false });
      if (kindFilter !== "todos") q = q.eq("tipo_comprobante", kindFilter);
      if (clientFilter.trim()) q = q.ilike("cliente_nombre", `%${clientFilter.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const allChecked = list.length > 0 && selected.size === list.length;
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(list.map(l => l.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const saveCounter = async () => {
    if (!editing) return;
    const val = parseInt(newValue);
    if (isNaN(val) || val < 0) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.rpc("admin_set_comprobante_counter" as any, { _kind: editing.kind, _value: val });
    if (error) { toast.error(error.message); return; }
    toast.success(`Correlativo de ${editing.label} actualizado a ${val}. Próximo: ${val + 1}.`);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["comprobante_counters"] });
  };

  const generateZip = async () => {
    const ids = selected.size > 0 ? Array.from(selected) : list.map(l => l.id);
    if (ids.length === 0) { toast.error("No hay comprobantes para descargar"); return; }
    setGenerating(true);
    try {
      // Load items + company info in batch
      const { data: items } = await supabase
        .from("transaction_items")
        .select("transaction_id, descripcion, cantidad, precio_unitario, subtotal, item_type")
        .in("transaction_id", ids);
      const itemsByTx: Record<string, any[]> = {};
      (items || []).forEach((it: any) => {
        (itemsByTx[it.transaction_id] = itemsByTx[it.transaction_id] || []).push(it);
      });

      const company = { name: "INFOCOM SOLUCIONES" };

      const zip = new JSZip();
      const txMap: Record<string, any> = {};
      list.forEach(l => { txMap[l.id] = l; });

      for (const id of ids) {
        const tx = txMap[id];
        if (!tx) continue;
        const pdf = buildPdf(tx, itemsByTx[id] || [], company);
        const kindDef = DOCUMENT_KINDS.find(d => d.value === tx.tipo_comprobante);
        const kindShort = (kindDef?.short || tx.tipo_comprobante || "comp").replace(/[^a-z0-9]/gi, "_");
        const num = (tx.numero_comprobante || tx.ticket_number || tx.id.slice(0,6));
        const fname = `${kindShort}_${num}_${(tx.cliente_nombre || "sin_cliente").replace(/[^a-z0-9]/gi, "_").slice(0,30)}.pdf`;
        zip.file(fname, pdf.output("arraybuffer"));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const label = mode === "month" ? `${MONTHS[month]}_${year}` : `${fromDate}_a_${toDate}`;
      saveAs(blob, `comprobantes_${label}.zip`);
      toast.success(`ZIP generado con ${ids.length} comprobante(s)`);
    } catch (err: any) {
      toast.error("Error generando ZIP: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-primary/40">
            <Receipt className="h-3.5 w-3.5 text-primary" />
            <span>Comprobantes</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Centro de Comprobantes</SheetTitle>
            <SheetDescription>Correlativos por tipo y descarga masiva de PDFs.</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Counters */}
            <Card className="p-3 bg-secondary/30 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide">Correlativos por tipo</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DOCUMENT_KINDS.map(dk => {
                  const last = counters[dk.value] || 0;
                  const total = counts[dk.value] || 0;
                  return (
                    <div
                      key={dk.value}
                      className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-background/60 px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] text-muted-foreground truncate">{dk.label}</div>
                        <div className="text-sm font-bold font-mono">N° {String(last).padStart(6, "0")}</div>
                        <div className="text-[10px] text-muted-foreground">Emitidos: {total}</div>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing({ kind: dk.value, label: dk.label, value: last }); setNewValue(String(last)); }} title="Ajustar correlativo">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Download section */}
            <Card className="p-3 border-primary/30">
              <div className="flex items-center gap-2 mb-3">
                <FolderArchive className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide">Descarga masiva (ZIP)</span>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant={mode === "month" ? "default" : "outline"} className="h-7 text-xs flex-1" onClick={() => setMode("month")}>Por mes</Button>
                  <Button size="sm" variant={mode === "range" ? "default" : "outline"} className="h-7 text-xs flex-1" onClick={() => setMode("range")}>Rango de fechas</Button>
                </div>

                {mode === "month" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Mes</Label>
                      <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Año</Label>
                      <Input type="number" className="h-8 text-xs" value={year} onChange={e => setYear(parseInt(e.target.value) || today.getFullYear())} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Desde</Label>
                      <Input type="date" className="h-8 text-xs" value={from} onChange={e => setFrom(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Hasta</Label>
                      <Input type="date" className="h-8 text-xs" value={to} onChange={e => setTo(e.target.value)} />
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-[10px]">Tipo de comprobante</Label>
                  <Select value={kindFilter} onValueChange={setKindFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los tipos</SelectItem>
                      {DOCUMENT_KINDS.map(dk => <SelectItem key={dk.value} value={dk.value}>{dk.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px]">Cliente (opcional)</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Buscar por nombre de cliente..."
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                  />
                </div>

                <div className="rounded-md border border-primary/20 bg-background/40">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                      <span className="text-[11px]">
                        {isLoading ? "Cargando..." : `${list.length} encontrado(s)`}
                        {selected.size > 0 ? ` · ${selected.size} seleccionado(s)` : ""}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Marca para descargar solo algunos</span>
                  </div>
                  <ScrollArea className="h-[220px]">
                    {list.length === 0 && !isLoading && (
                      <div className="p-4 text-center text-[11px] text-muted-foreground">Sin comprobantes en este período.</div>
                    )}
                    {list.map(tx => {
                      const def = DOCUMENT_KINDS.find(d => d.value === tx.tipo_comprobante);
                      return (
                        <div key={tx.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-primary/5 border-b border-primary/10 last:border-0">
                          <Checkbox checked={selected.has(tx.id)} onCheckedChange={() => toggleOne(tx.id)} />
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleOne(tx.id)}>
                            <div className="text-[11px] font-medium truncate">
                              {def?.short || tx.tipo_comprobante} N° {tx.numero_comprobante || tx.ticket_number || "—"}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {new Date(tx.fecha).toLocaleDateString("es-PE")} · {tx.cliente_nombre || "—"}
                            </div>
                          </div>
                          <div className="text-[11px] font-mono font-bold">S/ {Number(tx.total || 0).toFixed(2)}</div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-primary"
                            title="Personalizar e imprimir"
                            onClick={(e) => { e.stopPropagation(); setCustomPrint({ id: tx.id, kind: tx.tipo_comprobante || "boleta" }); }}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </ScrollArea>
                </div>

                <Button className="w-full gap-2" onClick={generateZip} disabled={generating || list.length === 0}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Generar y descargar ZIP {selected.size > 0 ? `(${selected.size})` : `(${list.length})`}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">Los PDFs se generan al momento de la descarga.</p>
              </div>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar correlativo — {editing?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Último número emitido (el siguiente será este +1)</Label>
            <Input type="number" min={0} value={newValue} onChange={e => setNewValue(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Valor actual: <strong>{editing?.value}</strong>.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveCounter}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {customPrint && (
        <CustomPrintDialog
          open={!!customPrint}
          onClose={() => setCustomPrint(null)}
          source="transaction"
          sourceId={customPrint.id}
          kind={customPrint.kind}
        />
      )}
    </>
  );
}

function buildPdf(tx: any, items: any[], company: any): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const kindDef = DOCUMENT_KINDS.find(d => d.value === tx.tipo_comprobante);
  const title = (kindDef?.label || "COMPROBANTE").toUpperCase();
  const num = tx.numero_comprobante || tx.ticket_number || "------";

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(String(company.name || "INFOCOM").toUpperCase(), 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 23;
  if (company.ruc) { doc.text(`RUC: ${company.ruc}`, 14, y); y += 4; }
  if (company.address) { doc.text(String(company.address), 14, y); y += 4; }
  if (company.phone) { doc.text(`Tel: ${company.phone}`, 14, y); y += 4; }

  // Title box
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(140, 14, 55, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, 167.5, 21, { align: "center" });
  doc.setFontSize(12);
  doc.text(`N° ${num}`, 167.5, 28, { align: "center" });

  // Customer info
  y = Math.max(y, 38);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Fecha:", 14, y); doc.setFont("helvetica", "normal");
  doc.text(new Date(tx.fecha).toLocaleDateString("es-PE"), 30, y);
  doc.setFont("helvetica", "bold"); doc.text("Cliente:", 80, y); doc.setFont("helvetica", "normal");
  doc.text(String(tx.cliente_nombre || "—"), 100, y);
  y += 5;
  if (tx.cliente_telefono) {
    doc.setFont("helvetica", "bold"); doc.text("Teléfono:", 14, y); doc.setFont("helvetica", "normal");
    doc.text(String(tx.cliente_telefono), 30, y);
    y += 5;
  }

  // Items table
  autoTable(doc, {
    startY: y + 2,
    head: [["N°", "Cant.", "Descripción", "P. Unit.", "Subtotal"]],
    body: items.map((it, i) => [
      String(i + 1),
      String(it.cantidad),
      String(it.descripcion || ""),
      `S/ ${Number(it.precio_unitario).toFixed(2)}`,
      `S/ ${Number(it.subtotal).toFixed(2)}`,
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: { 0: { halign: "center", cellWidth: 10 }, 1: { halign: "center", cellWidth: 15 }, 3: { halign: "right", cellWidth: 28 }, 4: { halign: "right", cellWidth: 30 } },
  });

  const endY = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("TOTAL: S/ " + Number(tx.total || 0).toFixed(2), 195, endY + 4, { align: "right" });

  // Footer
  doc.setFont("helvetica", "italic"); doc.setFontSize(8);
  doc.text(`© ${new Date().getFullYear()} ${company.name || "INFOCOM"}`, 105, 285, { align: "center" });

  return doc;
}
