import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Upload, Download, Trash2, Loader2, Eye } from "lucide-react";
import { sanitizeText } from "@/lib/sanitize";

const BUCKET = "staff-documents";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const StaffDocumentsSection = ({ staffId }: { staffId: string }) => {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["staff_documents", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_documents")
        .select("*")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!staffId,
  });

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > MAX_SIZE) { toast.error("Archivo demasiado grande (máx 10 MB)"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const safeName = sanitizeText(docName || file.name.replace(/\.[^.]+$/, ""), { maxLength: 120 });
      const path = `${staffId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;
      const { data: au } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("staff_documents").insert({
        staff_id: staffId,
        name: safeName || file.name,
        storage_path: path,
        file_type: file.type || ext,
        size_bytes: file.size,
        uploaded_by: au.user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("📎 Documento subido");
      setDocName("");
      qc.invalidateQueries({ queryKey: ["staff_documents", staffId] });
    } catch (e: any) {
      toast.error(e.message || "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const openSigned = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data) { toast.error("No se pudo abrir el archivo"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const deleteMut = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      const { error } = await supabase.from("staff_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento eliminado");
      qc.invalidateQueries({ queryKey: ["staff_documents", staffId] });
    },
  });

  return (
    <div className="space-y-3 border border-primary/10 rounded-lg p-3 bg-secondary/20">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <Label className="font-semibold">Documentos Adjuntos (CV, contratos en PDF)</Label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <Input
          placeholder="Nombre del documento (opcional)"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          maxLength={120}
        />
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".pdf,application/pdf,.doc,.docx,image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <Button asChild type="button" size="sm" className="gap-2 w-full sm:w-auto" disabled={uploading}>
            <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir PDF</span>
          </Button>
        </label>
      </div>
      <p className="text-[10px] text-muted-foreground">Formato preferido: PDF. Máx 10 MB. Acceso restringido por rol.</p>

      {isLoading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3 italic">Sin documentos cargados</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {docs.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between gap-2 bg-card border border-border/40 rounded-md px-2.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(d.size_bytes / 1024).toFixed(1)} KB • {new Date(d.created_at).toLocaleDateString("es-PE")}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSigned(d.storage_path)} title="Ver / Descargar">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(d)} title="Eliminar">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
