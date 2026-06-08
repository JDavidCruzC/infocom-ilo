import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, FileText } from "lucide-react";
import { toast } from "sonner";
import { DOCUMENT_KINDS, DocumentKind } from "./PrintReceipt";

interface Props {
  isAdmin: boolean;
  onFilter: (kind: string) => void;
}

export default function ComprobanteCountersPanel({ isAdmin, onFilter }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ kind: DocumentKind; label: string; value: number } | null>(null);
  const [newValue, setNewValue] = useState("");

  const { data: counters = {} } = useQuery({
    queryKey: ["comprobante_counters"],
    queryFn: async () => {
      const { data } = await supabase.from("store_settings").select("value").eq("key", "comprobante_counters").maybeSingle();
      return (data?.value as Record<string, number>) || {};
    },
    refetchOnWindowFocus: false,
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
    refetchOnWindowFocus: false,
  });

  const save = async () => {
    if (!editing) return;
    const val = parseInt(newValue);
    if (isNaN(val) || val < 0) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.rpc("admin_set_comprobante_counter" as any, { _kind: editing.kind, _value: val });
    if (error) { toast.error(error.message); return; }
    toast.success(`Correlativo de ${editing.label} actualizado a ${val}. El próximo será ${val + 1}.`);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["comprobante_counters"] });
  };

  return (
    <>
      <Card className="p-3 bg-secondary/30 border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide">Correlativos por tipo</span>
          <span className="text-[10px] text-muted-foreground ml-auto">Muestra el último número emitido y el total histórico.</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {DOCUMENT_KINDS.map(dk => {
            const last = counters[dk.value] || 0;
            const total = counts[dk.value] || 0;
            return (
              <button
                key={dk.value}
                type="button"
                onClick={() => onFilter(dk.value)}
                className="group flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-background/60 hover:bg-primary/10 hover:border-primary/50 transition px-2 py-1.5 text-left"
              >
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground truncate">{dk.label}</div>
                  <div className="text-sm font-bold font-mono">N° {String(last).padStart(6, "0")}</div>
                  <div className="text-[10px] text-muted-foreground">Emitidos: {total}</div>
                </div>
                {isAdmin && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setEditing({ kind: dk.value, label: dk.label, value: last }); setNewValue(String(last)); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditing({ kind: dk.value, label: dk.label, value: last }); setNewValue(String(last)); } }}
                    className="opacity-60 group-hover:opacity-100 p-1 rounded hover:bg-primary/20 cursor-pointer"
                    title="Ajustar correlativo"
                  >
                    <Pencil className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar correlativo — {editing?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Último número emitido (el siguiente será este +1)</Label>
            <Input type="number" min={0} value={newValue} onChange={e => setNewValue(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Valor actual: <strong>{editing?.value}</strong>. Cambia esto solo si necesitas resincronizar con tu numeración física.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
