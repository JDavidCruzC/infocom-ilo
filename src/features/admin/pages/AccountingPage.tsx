import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Receipt, Plus, ShoppingCart, Wrench, TrendingUp, ChevronLeft, ChevronRight,
  Trash2, Pencil, Printer, FileText, Ban, Eye, Package, Settings2, List, Search, ChevronsUpDown, Check, RotateCcw, Gift,
  Clock, CheckCircle2, FileBadge, FileCheck2, Palette, MessageCircle
} from "lucide-react";

// ─── Highlight color presets for "Por Cobrar" rows ──────────────
const HIGHLIGHT_PRESETS = [
  { key: "amber",   label: "INFOCOM #F0BA00", bg: "hsl(47 100% 47% / 0.48)", border: "hsl(47 100% 47%)" },
  { key: "rose",    label: "Rosa",      bg: "rgba(244, 63, 94, 0.28)",   border: "#f43f5e" },
  { key: "orange",  label: "Naranja",   bg: "rgba(249, 115, 22, 0.30)",  border: "#f97316" },
  { key: "yellow",  label: "Amarillo",  bg: "hsl(47 100% 47% / 0.36)",   border: "hsl(47 100% 47%)" },
  { key: "red",     label: "Rojo",      bg: "rgba(239, 68, 68, 0.25)",   border: "#ef4444" },
  { key: "fuchsia", label: "Fucsia",    bg: "rgba(217, 70, 239, 0.25)",  border: "#d946ef" },
  { key: "sky",     label: "Celeste",   bg: "rgba(14, 165, 233, 0.25)",  border: "#0ea5e9" },
  { key: "lime",    label: "Lima",      bg: "rgba(132, 204, 22, 0.30)",  border: "#84cc16" },
] as const;
const HIGHLIGHT_LS_KEY = "infocom_por_cobrar_highlight";
const HIGHLIGHT_CUSTOM_LS_KEY = "infocom_por_cobrar_highlight_custom";
const HIGHLIGHT_OPACITY_LS_KEY = "infocom_por_cobrar_highlight_opacity";

// Convert #RRGGBB to rgba with given alpha (0-1)
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return `rgba(240,186,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSecurityFlags } from "@/features/admin/hooks/useSecurityFlags";
import DataImportExport from "@/features/admin/components/DataImportExport";
import PrintReceipt, { DocumentKind, DOCUMENT_KINDS } from "@/features/admin/components/PrintReceipt";
import { notifyAllStaff } from "@/lib/notifications";
import ComprobantesDrawer from "@/features/admin/components/ComprobantesDrawer";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ─── Types ──────────────────────────────────────────────────────
interface TransactionItem {
  id?: string;
  item_type: "producto" | "servicio";
  referencia_id?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  // Service-specific fields
  responsable?: string;
  tipo_equipo?: string;
  diagnostico?: string;
  // Combo fields
  combo_id?: string | null;            // present on combo header AND its children
  combo_parent_local_id?: string | null; // local link for children → parent (UI only)
  is_combo_header?: boolean;            // true for the main combo line
  is_combo_child?: boolean;             // true for sub-items belonging to a combo
  precio_original?: number;             // for child items: original (non-promo) price
}

interface Transaction {
  id: string;
  fecha: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  estado: "borrador" | "emitido" | "anulado" | "devuelto";
  tipo_general: "venta" | "servicio" | "mixto";
  subtotal_productos: number;
  subtotal_servicios: number;
  impuestos: number;
  total: number;
  notas: string | null;
  emitido_por: string | null;
  emitido_en: string | null;
  anulado_en: string | null;
  anulado_por: string | null;
  motivo_anulacion: string | null;
  devuelto_en: string | null;
  devuelto_por: string | null;
  motivo_devolucion: string | null;
  por_cobrar?: boolean;
  cobrado_en?: string | null;
  tipo_cliente?: string | null;
  tipo_comprobante?: string | null;
  numero_comprobante?: string | null;
  created_at: string;
  items?: TransactionItem[];
}

// ─── Constants ──────────────────────────────────────────────────
const IMPORT_COLUMNS = [
  { key: "item_type", label: "Tipo (producto/servicio)" },
  { key: "descripcion", label: "Descripcion" },
  { key: "cantidad", label: "Cantidad" },
  { key: "precio_unitario", label: "Precio Unitario" },
];

// Colored-dot status (compact). label used in tooltip.
const STATUS_MAP: Record<string, { label: string; dot: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  borrador: { label: "Borrador", dot: "bg-muted-foreground", variant: "secondary" },
  emitido: { label: "Emitido", dot: "bg-success", variant: "default" },
  anulado: { label: "Anulado", dot: "bg-destructive", variant: "destructive" },
  devuelto: { label: "Devuelto", dot: "bg-amber-500", variant: "outline" },
};

const TYPE_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  venta: { label: "Venta", icon: <ShoppingCart className="h-4 w-4" />, color: "text-emerald-500" },
  servicio: { label: "Servicio", icon: <Wrench className="h-4 w-4" />, color: "text-blue-500" },
  mixto: { label: "Mixto", icon: <List className="h-4 w-4" />, color: "text-violet-500" },
};

// Compact per-row Download/Share buttons. Lazy-loads transaction items on first
// interaction (hover/focus) so we don't issue a query for every row at mount.
const RowReceiptActions: React.FC<{ tx: Transaction }> = ({ tx }) => {
  const [items, setItems] = useState<TransactionItem[] | null>(tx.items ?? null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current || items) return;
    loadedRef.current = true;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("transaction_items")
        .select("*")
        .eq("transaction_id", tx.id)
        .order("created_at");
      setItems((data || []) as any);
    } finally {
      setLoading(false);
    }
  }, [tx.id, items]);

  const order = useMemo(() => ({
    id: tx.id,
    created_at: tx.created_at,
    date: tx.fecha,
    numero_comprobante: tx.numero_comprobante,
    ticket_number: tx.numero_comprobante,
    customer_name: tx.cliente_nombre || "",
    customer_phone: tx.cliente_telefono || "",
    seller: tx.emitido_por || "Admin",
    items: (items || []).map((it: any) => ({
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      subtotal: it.subtotal,
      item_type: it.item_type,
      responsable: it.responsable,
      tipo_equipo: it.tipo_equipo,
      diagnostico: it.diagnostico,
    })),
    subtotal_productos: tx.subtotal_productos,
    igv: tx.impuestos,
    total: tx.total,
    payment_method: (tx as any).metodo_pago,
    notes: tx.notas,
  }), [tx, items]);

  return (
    <span
      onMouseEnter={ensureLoaded}
      onFocus={ensureLoaded}
      onClickCapture={ensureLoaded}
      className="inline-flex"
      title={loading ? "Cargando comprobante…" : undefined}
    >
      <PrintReceipt
        order={order}
        type={tx.tipo_general === "servicio" ? "service" : "sale"}
        defaultDocumentKind={(tx.tipo_comprobante as DocumentKind) || "boleta"}
        compact
      />
    </span>
  );
};

// ─── Component ──────────────────────────────────────────────────
const AccountingPage = () => {
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();
  const { data: secFlags } = useSecurityFlags();
  const canDelete = isAdmin && !!secFlags?.allow_delete_transactions;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<"todos" | "ventas" | "servicios" | "por_cobrar" | "comprobantes">("todos");
  const [comprobantesFilter, setComprobantesFilter] = useState<string>("todos");
  // Search popover open state per item (combobox bug fix)
  const [openComboIdx, setOpenComboIdx] = useState<number | null>(null);
  const [clientComboOpen, setClientComboOpen] = useState(false);
  const [comboPickerOpen, setComboPickerOpen] = useState(false);

  const closeAccountingCombos = useCallback(() => {
    setOpenComboIdx(null);
    setClientComboOpen(false);
    setComboPickerOpen(false);
    window.setTimeout(() => {
      setOpenComboIdx(null);
      setClientComboOpen(false);
      setComboPickerOpen(false);
    }, 0);
  }, []);

  const [searchClient, setSearchClient] = useState("");
  const [highlightKey, setHighlightKey] = useState<string>(() => {
    if (typeof window === "undefined") return "amber";
    return localStorage.getItem(HIGHLIGHT_LS_KEY) || "amber";
  });
  const [customHex, setCustomHex] = useState<string>(() => {
    if (typeof window === "undefined") return "#F0BA00";
    return localStorage.getItem(HIGHLIGHT_CUSTOM_LS_KEY) || "#F0BA00";
  });
  const [highlightOpacity, setHighlightOpacity] = useState<number>(() => {
    if (typeof window === "undefined") return 0.45;
    const v = parseFloat(localStorage.getItem(HIGHLIGHT_OPACITY_LS_KEY) || "0.45");
    return isNaN(v) ? 0.45 : v;
  });
  const highlight = highlightKey === "custom"
    ? { key: "custom", label: `Custom ${customHex}`, bg: hexToRgba(customHex, highlightOpacity), border: customHex }
    : (() => {
        const preset = HIGHLIGHT_PRESETS.find(h => h.key === highlightKey) || HIGHLIGHT_PRESETS[0];
        // Re-apply opacity for preset borders that are hex
        if (preset.border.startsWith("#")) {
          return { ...preset, bg: hexToRgba(preset.border, highlightOpacity) };
        }
        // For HSL borders (amber/yellow preset)
        const hslMatch = preset.border.match(/hsl\(([^)]+)\)/);
        if (hslMatch) return { ...preset, bg: `hsl(${hslMatch[1]} / ${highlightOpacity})` };
        return preset;
      })();
  useEffect(() => { try { localStorage.setItem(HIGHLIGHT_LS_KEY, highlightKey); } catch {} }, [highlightKey]);
  useEffect(() => { try { localStorage.setItem(HIGHLIGHT_CUSTOM_LS_KEY, customHex); } catch {} }, [customHex]);
  useEffect(() => { try { localStorage.setItem(HIGHLIGHT_OPACITY_LS_KEY, String(highlightOpacity)); } catch {} }, [highlightOpacity]);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("nueva") === "1") {
      setFormOpen(true);
      const np = new URLSearchParams(searchParams);
      np.delete("nueva");
      setSearchParams(np, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [detailOpen, setDetailOpen] = useState(false);
  const [anularOpen, setAnularOpen] = useState(false);
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [serviceTypesOpen, setServiceTypesOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingTx, setViewingTx] = useState<Transaction | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [motivoDevolucion, setMotivoDevolucion] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");

  // Post-emit print prompt
  const [printPromptOpen, setPrintPromptOpen] = useState(false);
  const [postEmitTx, setPostEmitTx] = useState<Transaction | null>(null);
  const [postEmitDocKind, setPostEmitDocKind] = useState<DocumentKind | undefined>(undefined);
  const [emitPickerOpen, setEmitPickerOpen] = useState(false);
  const [emitPickerKind, setEmitPickerKind] = useState<DocumentKind>("ticket_servicio");

  // Form state
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    cliente_nombre: "",
    cliente_telefono: "",
    notas: "",
    emitido_por: "Personal de Infocom",
    por_cobrar: false,
    tipo_cliente: "publico" as "publico" | "privado" | "corporativo",
  });
  const [items, setItems] = useState<TransactionItem[]>([]);

  // ─── Date range ───────────────────────────────────────────────
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  // ─── Queries ──────────────────────────────────────────────────
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("fecha", startDate)
        .lte("fecha", endDate)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Pendientes por cobrar — TODOS los meses (acumulados, no se pierden)
  const { data: allPorCobrar = [] } = useQuery({
    queryKey: ["transactions_por_cobrar_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("por_cobrar", true)
        .is("cobrado_en", null)
        .eq("estado", "emitido")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Gastos y compras del mes (para mostrar y restar al neto)
  const { data: monthExpenses = [] } = useQuery({
    queryKey: ["accounting_expenses", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses" as any)
        .select("amount, category, expense_date, description")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: monthPurchases = [] } = useQuery({
    queryKey: ["accounting_purchases", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("total, status, order_date")
        .gte("order_date", startDate)
        .lte("order_date", endDate)
        .neq("status", "cancelado");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Products from inventory
  const { data: products = [] } = useQuery({
    queryKey: ["products_for_accounting"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, price, stock, sku").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Active combos
  const { data: combos = [] } = useQuery({
    queryKey: ["combos_for_accounting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("id, name, description, promo_price, combo_type, stock, combo_items(id, product_id, product_name, quantity, unit_price)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: existingCustomers = [] } = useQuery({
    queryKey: ["customers_for_accounting"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, full_name, phone, document_number").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Staff members for dropdowns
  const { data: staffMembers = [] } = useQuery({
    queryKey: ["staff_for_accounting"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("id, full_name, position").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Service types from settings (with prices)
  interface ServiceType { name: string; price: number }
  const { data: serviceTypesRow } = useQuery({
    queryKey: ["store_settings", "service_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_settings").select("*").eq("key", "service_types").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const SERVICE_TYPES: ServiceType[] = useMemo(() => {
    if (!serviceTypesRow?.value) return [];
    const val = serviceTypesRow.value;
    if (Array.isArray(val)) {
      return val.map((v: any) => typeof v === "string" ? { name: v, price: 0 } : { name: v.name, price: Number(v.price) || 0 });
    }
    return [];
  }, [serviceTypesRow]);

  const saveServiceTypes = useMutation({
    mutationFn: async (types: ServiceType[]) => {
      const { error } = await supabase
        .from("store_settings")
        .upsert({ key: "service_types", value: types as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store_settings", "service_types"] });
      toast.success("Tipos de servicio actualizados");
    },
  });

  // ─── Items summary (descripción breve por transacción) ───────
  const txIds = transactions.map(t => t.id);
  const { data: itemsSummary = {} } = useQuery({
    queryKey: ["tx_items_summary", txIds.join(",")],
    enabled: txIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_items")
        .select("transaction_id, descripcion, item_type, cantidad")
        .in("transaction_id", txIds)
        .is("combo_parent_item_id", null);
      if (error) throw error;
      const map: Record<string, { descripcion: string; count: number; total: number }> = {};
      (data || []).forEach((it: any) => {
        if (!map[it.transaction_id]) map[it.transaction_id] = { descripcion: it.descripcion, count: 1, total: 1 };
        else { map[it.transaction_id].count += 1; map[it.transaction_id].total += 1; }
      });
      return map;
    },
  });

  // ─── Filtered views ───────────────────────────────────────────
  const filtered = useMemo(() => {
    // Para "Por Cobrar" mostramos TODOS los pendientes (acumulados de todos los meses)
    let list = activeTab === "por_cobrar" ? (allPorCobrar as Transaction[]) : transactions;
    if (activeTab === "ventas") list = list.filter(t => Number(t.subtotal_productos || 0) > 0);
    if (activeTab === "servicios") list = list.filter(t => Number(t.subtotal_servicios || 0) > 0);
    if (activeTab === "comprobantes") {
      list = list.filter(t => t.estado === "emitido" && (t.tipo_comprobante || t.numero_comprobante));
      if (comprobantesFilter !== "todos") list = list.filter(t => t.tipo_comprobante === comprobantesFilter);
    }
    if (searchClient.trim()) {
      const q = searchClient.toLowerCase();
      list = list.filter(t => t.cliente_nombre?.toLowerCase().includes(q));
    }
    return list;
  }, [transactions, allPorCobrar, activeTab, searchClient, comprobantesFilter]);

  // ─── Metrics ───────────────────────────────────────────────────
  const emitidos = transactions.filter(t => t.estado === "emitido");
  const cobrados = emitidos.filter(t => !t.por_cobrar || t.cobrado_en);
  const porCobrar = allPorCobrar as Transaction[];
  const totalProductos = cobrados.reduce((a, t) => a + Number(t.subtotal_productos || 0), 0);
  const totalServicios = cobrados.reduce((a, t) => a + Number(t.subtotal_servicios || 0), 0);
  const totalGeneral = cobrados.reduce((a, t) => a + Number(t.total || 0), 0);
  const totalPorCobrar = porCobrar.reduce((a, t) => a + Number(t.total || 0), 0);
  const totalGastos = monthExpenses.reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
  const totalCompras = monthPurchases.reduce((a: number, p: any) => a + Number(p.total || 0), 0);
  const netoMes = totalGeneral - totalGastos - totalCompras;

  // ─── Mutations ────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error("Agrega al menos un item");

      if (editingId) {
        // Update existing transaction
        const { error } = await supabase.from("transactions").update({
          fecha: form.fecha,
          cliente_nombre: form.cliente_nombre || null,
          cliente_telefono: form.cliente_telefono || null,
          notas: form.notas || null,
          emitido_por: form.emitido_por || null,
          por_cobrar: form.por_cobrar,
          tipo_cliente: form.tipo_cliente,
        } as any).eq("id", editingId);
        if (error) throw error;

        // Delete old items, insert new — header first, then children with parent FK
        await supabase.from("transaction_items").delete().eq("transaction_id", editingId);
        // Insert headers + standalones first, capture local→db id map
        const localIdMap: Record<string, string> = {};
        const headerPayload = items
          .filter(it => !it.is_combo_child)
          .map(it => ({
            transaction_id: editingId,
            item_type: it.item_type,
            referencia_id: it.referencia_id && it.referencia_id !== "service" ? it.referencia_id : null,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            subtotal: it.cantidad * it.precio_unitario,
            responsable: it.responsable || null,
            tipo_equipo: it.tipo_equipo || null,
            diagnostico: it.diagnostico || null,
            combo_id: it.combo_id || null,
          }));
        const { data: hdrRows, error: ie } = await supabase.from("transaction_items").insert(headerPayload as any).select("id, descripcion, combo_id");
        if (ie) throw ie;
        // Map local combo_parent_local_id → db id (by combo_id + descripcion match for the header)
        items.filter(it => it.is_combo_header).forEach(h => {
          const found = (hdrRows || []).find((r: any) => r.combo_id === h.combo_id && r.descripcion === h.descripcion);
          if (found && h.combo_parent_local_id) localIdMap[h.combo_parent_local_id] = found.id;
        });
        // Children
        const childPayload = items
          .filter(it => it.is_combo_child)
          .map(it => ({
            transaction_id: editingId,
            item_type: it.item_type,
            referencia_id: it.referencia_id && it.referencia_id !== "service" ? it.referencia_id : null,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            subtotal: it.cantidad * it.precio_unitario,
            combo_id: it.combo_id || null,
            combo_parent_item_id: it.combo_parent_local_id ? (localIdMap[it.combo_parent_local_id] || null) : null,
          }));
        if (childPayload.length > 0) {
          const { error: ce } = await supabase.from("transaction_items").insert(childPayload as any);
          if (ce) throw ce;
        }

        // Log history
        await supabase.from("transaction_history").insert({
          transaction_id: editingId,
          accion: "editado",
          detalles: { items: items.length },
          usuario_id: user?.id || null,
        });
      } else {
        // Create new transaction
        const { data: tx, error } = await supabase.from("transactions").insert({
          fecha: form.fecha,
          cliente_nombre: form.cliente_nombre || null,
          cliente_telefono: form.cliente_telefono || null,
          notas: form.notas || null,
          emitido_por: form.emitido_por || null,
          por_cobrar: form.por_cobrar,
          tipo_cliente: form.tipo_cliente,
          created_by: user?.id || null,
        } as any).select("id").single();
        if (error) throw error;

        // Headers + standalones first
        const localIdMap2: Record<string, string> = {};
        const headerPayload = items
          .filter(it => !it.is_combo_child)
          .map(it => ({
            transaction_id: tx.id,
            item_type: it.item_type,
            referencia_id: it.referencia_id && it.referencia_id !== "service" ? it.referencia_id : null,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            subtotal: it.cantidad * it.precio_unitario,
            responsable: it.responsable || null,
            tipo_equipo: it.tipo_equipo || null,
            diagnostico: it.diagnostico || null,
            combo_id: it.combo_id || null,
          }));
        const { data: hdrRows2, error: ie } = await supabase.from("transaction_items").insert(headerPayload as any).select("id, descripcion, combo_id");
        if (ie) throw ie;
        items.filter(it => it.is_combo_header).forEach(h => {
          const found = (hdrRows2 || []).find((r: any) => r.combo_id === h.combo_id && r.descripcion === h.descripcion);
          if (found && h.combo_parent_local_id) localIdMap2[h.combo_parent_local_id] = found.id;
        });
        const childPayload2 = items
          .filter(it => it.is_combo_child)
          .map(it => ({
            transaction_id: tx.id,
            item_type: it.item_type,
            referencia_id: it.referencia_id && it.referencia_id !== "service" ? it.referencia_id : null,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            subtotal: it.cantidad * it.precio_unitario,
            combo_id: it.combo_id || null,
            combo_parent_item_id: it.combo_parent_local_id ? (localIdMap2[it.combo_parent_local_id] || null) : null,
          }));
        if (childPayload2.length > 0) {
          const { error: ce } = await supabase.from("transaction_items").insert(childPayload2 as any);
          if (ce) throw ce;
        }

        await supabase.from("transaction_history").insert({
          transaction_id: tx.id,
          accion: "creado",
          detalles: { items: items.length },
          usuario_id: user?.id || null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
      toast.success(editingId ? "Transaccion actualizada" : "Transaccion guardada");
      if (!editingId) {
        const hasService = items.some(i => i.item_type === "servicio");
        const tipo = hasService ? "servicio" : "venta";
        notifyAllStaff({
          title: `Nueva ${tipo === "servicio" ? "orden de servicio" : "venta"} registrada`,
          message: `${form.cliente_nombre || "Sin cliente"} — S/. ${itemTotals.total.toFixed(2)}`,
          type: tipo === "servicio" ? "service" : "sale",
          link: "/admin/contabilidad",
          excludeUserId: user?.id,
        });
      }
      closeForm();
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  const emitirMutation = useMutation({
    mutationFn: async (id: string) => {
      // Get transaction data for customer sync
      const { data: txData } = await supabase.from("transactions").select("cliente_nombre, cliente_telefono, total").eq("id", id).single();

      const { error } = await supabase.from("transactions").update({
        estado: "emitido" as any,
        emitido_en: new Date().toISOString(),
        emitido_por: form.emitido_por || user?.email || "Admin",
      }).eq("id", id);
      if (error) throw error;

      // Reduce stock
      await reduceStockForTransaction(id);

      // Sync customer
      if (txData?.cliente_nombre) {
        await syncCustomer(txData.cliente_nombre, txData.cliente_telefono, Number(txData.total || 0));
      }

      await supabase.from("transaction_history").insert({
        transaction_id: id, accion: "emitido", usuario_id: user?.id || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
      toast.success("Transacción emitida — Stock actualizado");
    },
  });

  const anularMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").update({
        estado: "anulado" as any,
        anulado_en: new Date().toISOString(),
        anulado_por: user?.email || "Admin",
        motivo_anulacion: motivoAnulacion || null,
      }).eq("id", id);
      if (error) throw error;

      // Return stock for product items (anulación)
      const { data: txItems } = await supabase.from("transaction_items").select("*").eq("transaction_id", id).eq("item_type", "producto");
      for (const it of txItems || []) {
        if (it.referencia_id && it.referencia_id !== "service") {
          const { data: prod } = await supabase.from("products").select("stock").eq("id", it.referencia_id).single();
          if (prod) {
            const stockBefore = prod.stock;
            const stockAfter = stockBefore + (it.cantidad || 0);
            await supabase.from("products").update({ stock: stockAfter } as any).eq("id", it.referencia_id);
            await supabase.from("inventory_movements").insert({
              product_id: it.referencia_id, product_name: it.descripcion,
              movement_type: "anulacion", quantity: it.cantidad,
              reference_type: "anulacion", reference_id: id,
              stock_before: stockBefore, stock_after: stockAfter,
              created_by: user?.id || null,
            } as any);
          }
        }
      }

      await supabase.from("transaction_history").insert({
        transaction_id: id, accion: "anulado",
        detalles: { motivo: motivoAnulacion },
        usuario_id: user?.id || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Transacción anulada — Stock restaurado");
      setAnularOpen(false);
      setMotivoAnulacion("");
    },
  });

  const devolverMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").update({
        estado: "devuelto" as any,
        devuelto_en: new Date().toISOString(),
        devuelto_por: user?.email || "Admin",
        motivo_devolucion: motivoDevolucion || null,
      } as any).eq("id", id);
      if (error) throw error;

      // Return stock for product items (devolución)
      const { data: txItems } = await supabase.from("transaction_items").select("*").eq("transaction_id", id).eq("item_type", "producto");
      for (const it of txItems || []) {
        if (it.referencia_id && it.referencia_id !== "service") {
          const { data: prod } = await supabase.from("products").select("stock").eq("id", it.referencia_id).single();
          if (prod) {
            const stockBefore = prod.stock;
            const stockAfter = stockBefore + (it.cantidad || 0);
            await supabase.from("products").update({ stock: stockAfter } as any).eq("id", it.referencia_id);
            await supabase.from("inventory_movements").insert({
              product_id: it.referencia_id, product_name: it.descripcion,
              movement_type: "devolucion", quantity: it.cantidad,
              reference_type: "devolucion", reference_id: id,
              stock_before: stockBefore, stock_after: stockAfter,
              created_by: user?.id || null,
            } as any);
          }
        }
      }

      await supabase.from("transaction_history").insert({
        transaction_id: id, accion: "devuelto",
        detalles: { motivo: motivoDevolucion },
        usuario_id: user?.id || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Transacción marcada como devuelta — Stock restaurado");
      setDevolverOpen(false);
      setMotivoDevolucion("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
      toast.success("Borrador eliminado");
    },
  });

  const togglePorCobrarMutation = useMutation({
    mutationFn: async ({ id, por_cobrar }: { id: string; por_cobrar: boolean }) => {
      const { error } = await supabase.from("transactions").update({ por_cobrar, cobrado_en: por_cobrar ? null : undefined } as any).eq("id", id);
      if (error) throw error;
      await supabase.from("transaction_history").insert({ transaction_id: id, accion: por_cobrar ? "marcado_por_cobrar" : "desmarcado_por_cobrar", usuario_id: user?.id || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
      toast.success("Estado de cobro actualizado");
    },
  });

  const marcarCobradoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").update({ cobrado_en: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
      await supabase.from("transaction_history").insert({ transaction_id: id, accion: "cobrado", usuario_id: user?.id || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
      toast.success("Marcado como COBRADO ✓");
    },
  });

  // ─── Helpers ──────────────────────────────────────────────────
  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({ fecha: new Date().toISOString().split("T")[0], cliente_nombre: "", cliente_telefono: "", notas: "", emitido_por: "Personal de Infocom", por_cobrar: false, tipo_cliente: "publico" });
    setItems([]);
  };

  const openEdit = async (tx: Transaction) => {
    setForm({
      fecha: tx.fecha,
      cliente_nombre: tx.cliente_nombre || "",
      cliente_telefono: tx.cliente_telefono || "",
      notas: tx.notas || "",
      emitido_por: tx.emitido_por || "",
      por_cobrar: !!tx.por_cobrar,
      tipo_cliente: (tx.tipo_cliente as any) || "publico",
    });
    setEditingId(tx.id);
    // Load items
    const { data } = await supabase.from("transaction_items").select("*").eq("transaction_id", tx.id);
    setItems((data || []).map((d: any) => ({
      id: d.id, item_type: d.item_type, referencia_id: d.referencia_id,
      descripcion: d.descripcion, cantidad: d.cantidad,
      precio_unitario: Number(d.precio_unitario), subtotal: Number(d.subtotal),
      responsable: d.responsable || "", tipo_equipo: d.tipo_equipo || "", diagnostico: d.diagnostico || "",
    })));
    setFormOpen(true);
  };

  const openDetail = async (tx: Transaction) => {
    const { data } = await supabase.from("transaction_items").select("*").eq("transaction_id", tx.id);
    setViewingTx({
      ...tx,
      items: (data || []).map((d: any) => ({
        id: d.id, item_type: d.item_type, referencia_id: d.referencia_id,
        descripcion: d.descripcion, cantidad: d.cantidad,
        precio_unitario: Number(d.precio_unitario), subtotal: Number(d.subtotal),
        responsable: d.responsable || "", tipo_equipo: d.tipo_equipo || "", diagnostico: d.diagnostico || "",
      })),
    });
    setDetailOpen(true);
  };

  // ─── Emit transaction (used by Comprobante, Boleta, Factura) ──
  const emitNewTransaction = async (docKind?: DocumentKind) => {
    if (items.length === 0) return;
    try {
      // Default kind: if user didn't pick one, infer from content
      const inferredKind: DocumentKind = docKind || (
        items.some(i => i.item_type === "servicio") && !items.some(i => i.item_type === "producto")
          ? "ticket_servicio"
          : "ticket_venta"
      );
      const docMeta = DOCUMENT_KINDS.find(d => d.value === inferredKind);
      const docLabel = (docMeta?.label || inferredKind).toUpperCase();

      // Allocate correlative number for this kind
      const { data: numData, error: numErr } = await supabase.rpc("next_comprobante_number" as any, { _kind: inferredKind });
      if (numErr) throw numErr;
      const numeroComprobante = String(numData);

      const baseNotas = form.notas || "";
      const notasWithKind = `${baseNotas}${baseNotas ? " | " : ""}${docLabel} N° ${numeroComprobante}`;

      const { data: tx, error } = await supabase.from("transactions").insert({
        fecha: form.fecha,
        cliente_nombre: form.cliente_nombre || null,
        cliente_telefono: form.cliente_telefono || null,
        notas: notasWithKind || null,
        emitido_por: form.emitido_por || user?.email || "Admin",
        estado: "emitido" as any,
        emitido_en: new Date().toISOString(),
        por_cobrar: form.por_cobrar,
        tipo_cliente: form.tipo_cliente,
        tipo_comprobante: inferredKind,
        numero_comprobante: numeroComprobante,
        created_by: user?.id || null,
      } as any).select("id").single();
      if (error) throw error;

      const payload = items.map(it => ({
        transaction_id: tx.id,
        item_type: it.item_type,
        referencia_id: it.referencia_id || null,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.cantidad * it.precio_unitario,
        responsable: it.responsable || null,
        tipo_equipo: it.tipo_equipo || null,
        diagnostico: it.diagnostico || null,
      }));
      await supabase.from("transaction_items").insert(payload);
      await reduceStockForTransaction(tx.id);
      if (form.cliente_nombre) {
        await syncCustomer(form.cliente_nombre, form.cliente_telefono || null, itemTotals.total);
      }
      await supabase.from("transaction_history").insert({
        transaction_id: tx.id,
        accion: `emitido_${inferredKind}`,
        detalles: { numero_comprobante: numeroComprobante } as any,
        usuario_id: user?.id || null,
      });

      qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });

      const fullTx: Transaction = {
        id: tx.id,
        fecha: form.fecha,
        estado: "emitido",
        tipo_general: items.some(i => i.item_type === "producto") && items.some(i => i.item_type === "servicio")
          ? "mixto"
          : items.some(i => i.item_type === "servicio") ? "servicio" : "venta",
        cliente_nombre: form.cliente_nombre || null,
        cliente_telefono: form.cliente_telefono || null,
        notas: notasWithKind || null,
        emitido_por: form.emitido_por || user?.email || "Admin",
        emitido_en: new Date().toISOString(),
        por_cobrar: form.por_cobrar,
        subtotal_productos: itemTotals.productos,
        subtotal_servicios: itemTotals.servicios,
        total: itemTotals.total,
        tipo_comprobante: inferredKind,
        numero_comprobante: numeroComprobante,
        created_at: new Date().toISOString(),
        items: items.map(it => ({ ...it, subtotal: it.cantidad * it.precio_unitario })),
      } as any;

      toast.success(`${docLabel} N° ${numeroComprobante} emitido${form.por_cobrar ? " — PENDIENTE POR COBRAR" : ""}`);

      closeForm();
      setPostEmitTx(fullTx);
      setPostEmitDocKind(inferredKind);
      setPrintPromptOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Error al emitir");
    }
  };



  const addItem = (type: "producto" | "servicio") => {
    setItems([...items, { item_type: type, descripcion: "", cantidad: 1, precio_unitario: 0, subtotal: 0, responsable: "", tipo_equipo: "", diagnostico: "" }]);
  };

  const addCombo = (combo: any) => {
    const localId = `combo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const childItems = combo.combo_items || [];
    const sumOriginal = childItems.reduce((a: number, ci: any) => a + Number(ci.unit_price || 0) * Number(ci.quantity || 1), 0);
    const promo = Number(combo.promo_price || 0);

    // Header line: shows the combo name and the promo price
    const header: TransactionItem = {
      item_type: "producto",
      referencia_id: null,
      descripcion: `🎁 COMBO: ${combo.name}`,
      cantidad: 1,
      precio_unitario: promo,
      subtotal: promo,
      combo_id: combo.id,
      combo_parent_local_id: localId,
      is_combo_header: true,
      precio_original: sumOriginal,
    };

    // Child lines (informational, price 0 to not double-charge; original price kept for display)
    const children: TransactionItem[] = childItems.map((ci: any) => ({
      item_type: "producto" as const,
      referencia_id: ci.product_id || null,
      descripcion: `   ↳ ${ci.product_name}`,
      cantidad: Number(ci.quantity || 1),
      precio_unitario: 0,
      subtotal: 0,
      combo_id: combo.id,
      combo_parent_local_id: localId,
      is_combo_child: true,
      precio_original: Number(ci.unit_price || 0),
    }));

    setItems([...items, header, ...children]);
    toast.success(`Combo "${combo.name}" agregado — Ahorro: S/. ${(sumOriginal - promo).toFixed(2)}`);
  };

  const updateItem = (index: number, partial: Partial<TransactionItem>) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      const updated = { ...it, ...partial };
      updated.subtotal = updated.cantidad * updated.precio_unitario;
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => {
      const target = prev[index];
      // If removing a combo header, also remove its children
      if (target?.is_combo_header && target.combo_parent_local_id) {
        return prev.filter(it => it.combo_parent_local_id !== target.combo_parent_local_id);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const itemTotals = useMemo(() => {
    const productos = items.filter(i => i.item_type === "producto").reduce((a, i) => a + i.cantidad * i.precio_unitario, 0);
    const servicios = items.filter(i => i.item_type === "servicio").reduce((a, i) => a + i.cantidad * i.precio_unitario, 0);
    return { productos, servicios, total: productos + servicios };
  }, [items]);

  // ─── Customer sync helper ───────────────────────────────────
  const syncCustomer = useCallback(async (nombre: string, telefono: string | null, total: number) => {
    if (!nombre || nombre.trim().length < 2) return;
    const trimmedName = nombre.trim();
    try {
      // Check if customer exists by name (case insensitive)
      const { data: existing } = await supabase
        .from("customers")
        .select("id, total_purchases, total_spent")
        .ilike("full_name", trimmedName)
        .maybeSingle();

      if (existing) {
        // Update existing customer
        await supabase.from("customers").update({
          total_purchases: (existing.total_purchases || 0) + 1,
          total_spent: (existing.total_spent || 0) + total,
          last_purchase_at: new Date().toISOString(),
          phone: telefono || undefined,
        }).eq("id", existing.id);
      } else {
        // Create new customer
        await supabase.from("customers").insert({
          full_name: trimmedName,
          phone: telefono || null,
          total_purchases: 1,
          total_spent: total,
          last_purchase_at: new Date().toISOString(),
        });
      }
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers_for_accounting"] });
    } catch (e) {
      console.error("Error syncing customer:", e);
    }
  }, [qc]);

  // ─── Stock reduction helper ───────────────────────────────────
  const reduceStockForTransaction = useCallback(async (txId: string) => {
    const { data: txItems } = await supabase.from("transaction_items").select("*").eq("transaction_id", txId).eq("item_type", "producto");
    for (const it of txItems || []) {
      if (it.referencia_id && it.referencia_id !== "service") {
        const { data: prod } = await supabase.from("products").select("stock").eq("id", it.referencia_id).single();
        if (prod) {
          const stockBefore = prod.stock;
          const stockAfter = stockBefore - (it.cantidad || 0);
          await supabase.from("products").update({ stock: stockAfter } as any).eq("id", it.referencia_id);
          await supabase.from("inventory_movements").insert({
            product_id: it.referencia_id, product_name: it.descripcion,
            movement_type: "salida", quantity: it.cantidad,
            reference_type: "venta", reference_id: txId,
            stock_before: stockBefore, stock_after: stockAfter,
            created_by: user?.id || null,
          } as any);
        }
      }
    }
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["products_for_accounting"] });
  }, [user?.id, qc]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const getDisplayedAmounts = (tx: Transaction) => {
    const productos = Number(tx.subtotal_productos || 0);
    const servicios = Number(tx.subtotal_servicios || 0);

    if (activeTab === "ventas") {
      return { productos, servicios: 0, total: productos };
    }

    if (activeTab === "servicios") {
      return { productos: 0, servicios, total: servicios };
    }

    return { productos, servicios, total: Number(tx.total || 0) };
  };

  // ─── Export data ──────────────────────────────────────────────
  const exportColumns = [
    { key: "fecha", label: "Fecha" },
    { key: "tipo_general", label: "Tipo" },
    { key: "cliente_nombre", label: "Cliente" },
    { key: "cliente_telefono", label: "Teléfono" },
    { key: "estado", label: "Estado" },
    { key: "subtotal_productos", label: "Subtotal Productos" },
    { key: "subtotal_servicios", label: "Subtotal Servicios" },
    { key: "total", label: "Total" },
    { key: "emitido_por", label: "Emitido Por" },
    { key: "notas", label: "Notas" },
  ];

  const buildDetailedExport = async (): Promise<{ headers: string[]; rows: string[][] }> => {
    const headers = [
      "Código", "Fecha", "Tipo Transacción", "Estado", "Cliente", "Teléfono",
      "Tipo Item", "Descripción", "Cant.", "P. Unitario", "Subtotal",
      "Responsable", "Tipo Equipo", "Diagnóstico",
      "Total Productos", "Total Servicios", "TOTAL",
      "Emitido Por", "Notas"
    ];
    const rows: string[][] = [];

    // Sort by created_at for consistent code ordering
    const sorted = [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Fetch all items for filtered transactions
    const txIds = sorted.map(t => t.id);
    const { data: allItems } = await supabase
      .from("transaction_items")
      .select("*")
      .in("transaction_id", txIds);
    const itemsByTx = new Map<string, any[]>();
    (allItems || []).forEach((it: any) => {
      const list = itemsByTx.get(it.transaction_id) || [];
      list.push(it);
      itemsByTx.set(it.transaction_id, list);
    });

    sorted.forEach((tx, txIdx) => {
      const code = `TX-${String(txIdx + 1).padStart(4, "0")}`;
      const fecha = new Date(tx.fecha + "T12:00:00").toLocaleDateString("es-PE");
      const tipo = tx.tipo_general === "venta" ? "Venta" : tx.tipo_general === "servicio" ? "Servicio" : "Mixto";
      const estado = tx.estado === "emitido" ? "Emitido" : tx.estado === "anulado" ? "Anulado" : "Borrador";
      const txItems = itemsByTx.get(tx.id) || [];

      if (txItems.length === 0) {
        rows.push([
          code, fecha, tipo, estado, tx.cliente_nombre || "", tx.cliente_telefono || "",
          "", "", "", "", "", "", "", "",
          String(Number(tx.subtotal_productos || 0).toFixed(2)),
          String(Number(tx.subtotal_servicios || 0).toFixed(2)),
          String(Number(tx.total || 0).toFixed(2)),
          tx.emitido_por || "", tx.notas || "",
        ]);
      } else {
        txItems.forEach((item: any, idx: number) => {
          rows.push([
            idx === 0 ? code : "",
            idx === 0 ? fecha : "",
            idx === 0 ? tipo : "",
            idx === 0 ? estado : "",
            idx === 0 ? (tx.cliente_nombre || "") : "",
            idx === 0 ? (tx.cliente_telefono || "") : "",
            item.item_type === "producto" ? "Producto" : "Servicio",
            item.descripcion || "",
            String(item.cantidad || 1),
            String(Number(item.precio_unitario || 0).toFixed(2)),
            String(Number(item.subtotal || 0).toFixed(2)),
            item.responsable || "",
            item.tipo_equipo || "",
            item.diagnostico || "",
            idx === 0 ? String(Number(tx.subtotal_productos || 0).toFixed(2)) : "",
            idx === 0 ? String(Number(tx.subtotal_servicios || 0).toFixed(2)) : "",
            idx === 0 ? String(Number(tx.total || 0).toFixed(2)) : "",
            idx === 0 ? (tx.emitido_por || "") : "",
            idx === 0 ? (tx.notas || "") : "",
          ]);
        });
      }
    });

    // Summary row
    const totalProd = filtered.filter(t => t.estado === "emitido").reduce((a, t) => a + Number(t.subtotal_productos || 0), 0);
    const totalServ = filtered.filter(t => t.estado === "emitido").reduce((a, t) => a + Number(t.subtotal_servicios || 0), 0);
    const totalAll = filtered.filter(t => t.estado === "emitido").reduce((a, t) => a + Number(t.total || 0), 0);
    rows.push([]);
    rows.push([
      "", "", "", "", "", "", "", "", "", "", "",
      "", "", "",
      String(totalProd.toFixed(2)),
      String(totalServ.toFixed(2)),
      String(totalAll.toFixed(2)),
      "TOTALES (Emitidos)", ""
    ]);

    return { headers, rows };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" /> Contabilidad
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold text-sm min-w-[160px] text-center">{MONTHS[month]} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-success/20">
          <CardContent className="p-4 text-center">
            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-success" />
            <p className="text-xl sm:text-2xl font-bold text-success">S/. {totalProductos.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Ventas Cobradas</p>
          </CardContent>
        </Card>
        <Card className="border-info/20">
          <CardContent className="p-4 text-center">
            <Wrench className="h-5 w-5 mx-auto mb-1 text-info" />
            <p className="text-xl sm:text-2xl font-bold text-info">S/. {totalServicios.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Servicios Cobrados</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xl sm:text-2xl font-bold text-primary">S/. {totalGeneral.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Cobrado</p>
          </CardContent>
        </Card>
        <Card
          className={`border-amber-500/40 cursor-pointer transition hover:bg-amber-500/5 ${activeTab === "por_cobrar" ? "ring-2 ring-amber-500/50" : ""}`}
          onClick={() => setActiveTab("por_cobrar")}
        >
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-xl sm:text-2xl font-bold text-amber-500">S/. {totalPorCobrar.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Pendiente por Cobrar ({porCobrar.length})</p>
          </CardContent>
        </Card>
      </div>

      {/* Egresos & Neto */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <Receipt className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-xl sm:text-2xl font-bold text-destructive">- S/. {totalGastos.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Gastos del Mes ({monthExpenses.length})</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-4 text-center">
            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-xl sm:text-2xl font-bold text-orange-500">- S/. {totalCompras.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Compras del Mes ({monthPurchases.length})</p>
          </CardContent>
        </Card>
        <Card className={`border-2 ${netoMes >= 0 ? "border-primary/50 bg-primary/5" : "border-destructive/50 bg-destructive/10"}`}>
          <CardContent className="p-4 text-center">
            <TrendingUp className={`h-5 w-5 mx-auto mb-1 ${netoMes >= 0 ? "text-primary" : "text-destructive"}`} />
            <p className={`text-2xl sm:text-3xl font-bold font-display ${netoMes >= 0 ? "text-primary" : "text-destructive"}`}>
              S/. {netoMes.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Neto del Mes (Ingresos − Gastos − Compras)</p>
          </CardContent>
        </Card>
      </div>


      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todos" className="gap-1 text-xs sm:text-sm"><List className="h-4 w-4" /> Todos ({transactions.length})</TabsTrigger>
          <TabsTrigger value="ventas" className="gap-1 text-xs sm:text-sm"><ShoppingCart className="h-4 w-4" /> Ventas</TabsTrigger>
          <TabsTrigger value="servicios" className="gap-1 text-xs sm:text-sm"><Wrench className="h-4 w-4" /> Servicios</TabsTrigger>
          <TabsTrigger value="por_cobrar" className="gap-1 text-xs sm:text-sm data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300">
            <Clock className="h-4 w-4" /> Por Cobrar ({porCobrar.length})
          </TabsTrigger>
        </TabsList>



        {/* Shared content for all tabs */}
        <div className="mt-4 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Buscar por cliente..."
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                className="max-w-[200px] h-8 text-xs bg-secondary/50 border-primary/20"
              />
              {isAdmin && (
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setServiceTypesOpen(true)}>
                  <Settings2 className="h-3.5 w-3.5" /> Tipos de Servicio
                </Button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" title="Color de resaltado para Por Cobrar">
                    <Palette className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Resaltado</span>
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2"
                      style={{ background: highlight.bg, borderColor: highlight.border }}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">Color para "Por Cobrar"</p>
                  <div className="grid grid-cols-4 gap-2">
                    {HIGHLIGHT_PRESETS.map(h => (
                      <button
                        key={h.key}
                        type="button"
                        onClick={() => setHighlightKey(h.key)}
                        title={h.label}
                        className={`h-9 w-full rounded-md border-2 transition ${highlightKey === h.key ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-105" : "hover:scale-105"}`}
                        style={{ background: h.bg, borderColor: h.border }}
                      />
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Color personalizado</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customHex}
                        onChange={(e) => { setCustomHex(e.target.value.toUpperCase()); setHighlightKey("custom"); }}
                        className="h-9 w-12 rounded-md border cursor-pointer bg-transparent"
                        title="Selector visual"
                      />
                      <div className="flex-1 flex items-center gap-1 border rounded-md px-2 h-9 bg-background">
                        <span className="text-xs text-muted-foreground">#</span>
                        <input
                          type="text"
                          value={customHex.replace("#", "")}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();
                            const hex = "#" + v;
                            setCustomHex(hex);
                            if (v.length === 6) setHighlightKey("custom");
                          }}
                          placeholder="F0BA00"
                          maxLength={6}
                          className="flex-1 bg-transparent text-xs font-mono uppercase outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setHighlightKey("custom")}
                          className={`h-6 w-6 rounded border-2 ${highlightKey === "custom" ? "ring-2 ring-primary" : ""}`}
                          style={{ background: hexToRgba(customHex, highlightOpacity), borderColor: customHex }}
                          title="Usar este color"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-muted-foreground">Intensidad</label>
                        <span className="text-[10px] font-mono text-muted-foreground">{Math.round(highlightOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={5}
                        value={Math.round(highlightOpacity * 100)}
                        onChange={(e) => setHighlightOpacity(parseInt(e.target.value, 10) / 100)}
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>

                  <a
                    href="https://htmlcolorcodes.com/es/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-1.5 h-8 w-full rounded-md border border-primary/40 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition"
                  >
                    <Palette className="h-3.5 w-3.5" />
                    Buscar más colores en línea
                  </a>
                  <p className="text-[10px] text-muted-foreground mt-2">Se guarda automáticamente en este navegador.</p>
                </PopoverContent>
              </Popover>
            </div>
            <DataImportExport
              columns={IMPORT_COLUMNS}
              exportColumns={exportColumns}
              data={filtered}
              filenamePrefix={`contabilidad_${MONTHS[month]}_${year}`}
              templateDescription="Cada fila es un item. Tipo: 'producto' o 'servicio'."
              detailedExportFn={buildDetailedExport}
              onImport={async (rows) => {
                const { data: tx, error } = await supabase.from("transactions").insert({
                  fecha: new Date().toISOString().split("T")[0],
                  notas: "Importado desde CSV",
                  created_by: user?.id || null,
                }).select("id").single();
                if (error) throw error;
                const payload = rows.map(r => ({
                  transaction_id: tx.id,
                  item_type: (r.item_type?.toLowerCase() === "servicio" ? "servicio" : "producto") as any,
                  descripcion: r.descripcion || r["Descripcion"] || "",
                  cantidad: parseInt(r.cantidad || r["Cantidad"]) || 1,
                  precio_unitario: parseFloat(r.precio_unitario || r["Precio Unitario"]) || 0,
                  subtotal: (parseInt(r.cantidad) || 1) * (parseFloat(r.precio_unitario) || 0),
                }));
                const { error: ie } = await supabase.from("transaction_items").insert(payload);
                if (ie) throw ie;
                qc.invalidateQueries({ queryKey: ["transactions", month, year] }); qc.invalidateQueries({ queryKey: ["transactions_por_cobrar_all"] });
              }}
            />
            <ComprobantesDrawer isAdmin={isAdmin} />
            <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Nueva Transaccion
            </Button>

          </div>

          {/* Transactions table */}
          <TooltipProvider delayDuration={150}>
          <div className="border border-border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-12 text-center px-2">Tipo</TableHead>
                  <TableHead className="w-12 text-center px-2">Estado</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-right">Servicios</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {isLoading ? "Cargando..." : "No hay transacciones este mes"}
                    </TableCell>
                  </TableRow>
                ) : filtered.map((tx) => {
                  const st = STATUS_MAP[tx.estado];
                  const tp = TYPE_MAP[tx.tipo_general];
                  const displayedAmounts = getDisplayedAmounts(tx);
                  const summary = (itemsSummary as any)[tx.id];
                  const descPreview = summary
                    ? `${summary.descripcion}${summary.total > 1 ? ` +${summary.total - 1} más` : ""}`
                    : "—";
                  const isPorCobrar = tx.por_cobrar && !tx.cobrado_en && tx.estado === "emitido";
                  const rowClass = [
                    tx.estado === "anulado" || tx.estado === "devuelto" ? "opacity-60" : "",
                    isPorCobrar ? "font-medium" : "",
                  ].join(" ");
                  const rowStyle: React.CSSProperties | undefined = isPorCobrar
                    ? {
                        backgroundColor: highlight.bg,
                        borderLeft: `6px solid ${highlight.border}`,
                        boxShadow: `inset 0 0 0 2px ${highlight.border}, 0 0 18px ${highlight.border}`,
                      }
                    : undefined;

                  return (
                    <TableRow key={tx.id} className={rowClass} style={rowStyle}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(tx.fecha + "T12:00:00").toLocaleDateString("es-PE")}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-sm">{tx.cliente_nombre || "—"}</span>
                          {isPorCobrar && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  className="text-[9px] px-1.5 py-0 h-4 shrink-0 font-bold border text-white"
                                  style={{ background: highlight.border, borderColor: highlight.border }}
                                >
                                  POR COBRAR
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>Pendiente de cobro {tx.tipo_cliente ? `· ${tx.tipo_cliente}` : ""}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <span className="text-xs text-muted-foreground truncate block" title={descPreview}>{descPreview}</span>
                      </TableCell>
                      <TableCell className="text-center px-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center justify-center ${tp?.color || ""}`}>{tp?.icon}</span>
                          </TooltipTrigger>
                          <TooltipContent>{tp?.label}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-center px-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${st?.dot} ring-2 ring-background shadow`} />
                          </TooltipTrigger>
                          <TooltipContent>{st?.label}{isPorCobrar ? " · Por Cobrar" : ""}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right text-sm">S/. {displayedAmounts.productos.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">S/. {displayedAmounts.servicios.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-bold ${isPorCobrar ? "text-amber-600 dark:text-amber-400" : ""}`}>
                        S/. {displayedAmounts.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(tx)} title="Ver detalle">
                            <Eye className="h-3 w-3" />
                          </Button>
                          {(tx.estado === "borrador" || tx.estado === "emitido") && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tx)} title="Editar">
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {tx.estado === "borrador" && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 px-3 text-success font-semibold" onClick={() => emitirMutation.mutate(tx.id)} title="Emitir">
                                <FileText className="h-3 w-3 mr-1" /> Emitir
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Eliminar borrador?")) deleteMutation.mutate(tx.id); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </>
                          )}
                          {tx.estado === "emitido" && (
                            <>
                              {isPorCobrar ? (
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-600 font-semibold" onClick={() => marcarCobradoMutation.mutate(tx.id)} title="Marcar como cobrado">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Cobrado
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => togglePorCobrarMutation.mutate({ id: tx.id, por_cobrar: true })} title="Marcar como pendiente por cobrar">
                                  <Clock className="h-3 w-3" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setViewingTx(tx); setAnularOpen(true); }} title="Anular">
                                <Ban className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={() => { setViewingTx(tx); setDevolverOpen(true); }} title="Devolver">
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {(tx.estado === "emitido" || tx.estado === "borrador" || tx.estado === "devuelto") && (
                            <RowReceiptActions tx={tx} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </TooltipProvider>
        </div>
      </Tabs>

      {/* ─── NEW/EDIT TRANSACTION DIALOG ─── */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); else setFormOpen(true); }}>
        <DialogContent className="max-w-4xl w-[98vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {editingId ? "Editar Transaccion" : "Nueva Transaccion"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha *</Label><Input type="date" required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
              <div>
                <Label>Atendido Por</Label>
                <Select value={form.emitido_por} onValueChange={v => setForm({ ...form, emitido_por: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar personal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal de Infocom">Personal de Infocom</SelectItem>
                    {staffMembers.map((s: any) => <SelectItem key={s.id} value={s.full_name}>{s.full_name} — {s.position}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cliente</Label>
                <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 text-xs w-full justify-between font-normal">
                      {form.cliente_nombre || "Buscar o escribir cliente..."}
                      <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." className="h-9" />
                      <CommandList className="max-h-[200px] overflow-y-auto">
                        <CommandEmpty>No encontrado — escribe manualmente abajo</CommandEmpty>
                        <CommandGroup heading="Clientes registrados">
                          {existingCustomers.map((c: any) => (
                            <CommandItem key={c.id} value={`${c.full_name} ${c.phone || ""} ${c.document_number || ""}`} onSelect={() => {
                              setForm(prev => ({ ...prev, cliente_nombre: c.full_name, cliente_telefono: c.phone || prev.cliente_telefono }));
                              closeAccountingCombos();
                            }}>
                              <Check className={`h-3 w-3 mr-2 ${form.cliente_nombre === c.full_name ? "opacity-100" : "opacity-0"}`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium block">{c.full_name}</span>
                                {c.phone && <span className="text-[10px] text-muted-foreground">{c.phone}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Input
                  value={form.cliente_nombre}
                  onChange={e => setForm({ ...form, cliente_nombre: e.target.value })}
                  placeholder="O escribe el nombre manualmente..."
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div><Label>Telefono</Label><Input value={form.cliente_telefono} onChange={e => setForm({ ...form, cliente_telefono: e.target.value })} placeholder="999 999 999" /></div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-bold">Items</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => addItem("producto")}>
                    <Package className="h-3 w-3" /> Producto
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => addItem("servicio")}>
                    <Wrench className="h-3 w-3" /> Servicio
                  </Button>
                  <Popover open={comboPickerOpen} onOpenChange={setComboPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="default" size="sm" className="gap-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 text-white">
                        <Gift className="h-3 w-3" /> Combo
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[380px] p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Buscar combo / promoción..." className="h-9" />
                        <CommandList className="max-h-[280px]">
                          <CommandEmpty>No hay combos activos. Créalos en /admin/combos</CommandEmpty>
                          <CommandGroup heading={`Combos disponibles (${combos.length})`}>
                            {combos.map((c: any) => {
                              const childCount = (c.combo_items || []).length;
                              const sumOriginal = (c.combo_items || []).reduce((a: number, ci: any) => a + Number(ci.unit_price || 0) * Number(ci.quantity || 1), 0);
                              const ahorro = sumOriginal - Number(c.promo_price || 0);
                              return (
                                <CommandItem key={c.id} value={c.name} onSelect={() => { addCombo(c); closeAccountingCombos(); }}>
                                  <Gift className="h-3 w-3 mr-2 text-pink-500" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium truncate">{c.name}</span>
                                      <Badge variant="outline" className="text-[9px] px-1">{childCount} items</Badge>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      Original: <span className="line-through">S/. {sumOriginal.toFixed(2)}</span> · Ahorro: <span className="text-success font-bold">S/. {ahorro.toFixed(2)}</span>
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold text-primary ml-2">S/. {Number(c.promo_price).toFixed(2)}</span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                  Agrega productos o servicios a esta transaccion
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-3 space-y-2 ${
                        item.is_combo_header
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : item.is_combo_child
                          ? "border-dashed border-primary/20 bg-muted/30 ml-6 border-l-4 border-l-primary/40"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {item.is_combo_header ? (
                          <Badge className="text-xs shrink-0 bg-primary/20 text-primary border-primary/30">🎁 COMBO</Badge>
                        ) : item.is_combo_child ? (
                          <Badge variant="outline" className="text-[10px] shrink-0">↳ incluido</Badge>
                        ) : (
                          <Badge variant={item.item_type === "producto" ? "default" : "secondary"} className="text-xs shrink-0">
                            {item.item_type === "producto" ? "Producto" : "Servicio"}
                          </Badge>
                        )}
                        <div className="flex-1" />
                        {!item.is_combo_child && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_100px_90px] gap-2 items-end">
                        {/* Description - Combobox for both products and services */}
                        <div>
                          <Label className="text-xs text-muted-foreground">Descripción</Label>
                          {item.item_type === "producto" ? (
                            <>
                              <Popover open={openComboIdx === idx} onOpenChange={(o) => setOpenComboIdx(o ? idx : null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="h-9 text-xs w-full justify-between font-normal">
                                    <span className="truncate">{item.descripcion || "Seleccionar producto..."}</span>
                                    <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50 shrink-0" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Buscar producto..." className="h-9" />
                                    <CommandList className="max-h-[220px] overflow-y-auto">
                                      <CommandEmpty>No encontrado</CommandEmpty>
                                      <CommandGroup heading="Inventario">
                                        {products.map((p: any) => (
                                          <CommandItem key={p.id} value={`${p.name} ${p.sku || ""} ${p.id}`} onSelect={() => {
                                            updateItem(idx, { descripcion: p.name, precio_unitario: Number(p.price) || 0, referencia_id: p.id });
                                            closeAccountingCombos();
                                          }}>
                                            <Check className={`h-3 w-3 mr-2 ${item.referencia_id === p.id ? "opacity-100" : "opacity-0"}`} />
                                            <div className="flex-1 min-w-0">
                                              <span className="text-xs font-medium truncate block">{p.name}</span>
                                              {p.sku && <span className="text-[10px] text-muted-foreground">SKU: {p.sku}</span>}
                                            </div>
                                            <span className="text-xs font-bold text-primary ml-2">S/.{Number(p.price).toFixed(2)}</span>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                      <CommandGroup heading="Manual">
                                        <CommandItem value="__manual_prod__" onSelect={() => { updateItem(idx, { referencia_id: null, descripcion: "" }); closeAccountingCombos(); }}>
                                          <Package className="h-3 w-3 mr-2" /> Escribir manualmente
                                        </CommandItem>
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              {!item.referencia_id && (
                                <Input
                                  value={item.descripcion}
                                  onChange={e => updateItem(idx, { descripcion: e.target.value })}
                                  placeholder="Escribir nombre del producto..."
                                  className="h-8 text-xs mt-1"
                                />
                              )}
                            </>
                          ) : (
                            <>
                              <Popover open={openComboIdx === idx} onOpenChange={(o) => setOpenComboIdx(o ? idx : null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="h-9 text-xs w-full justify-between font-normal">
                                    <span className="truncate">{item.descripcion || "Seleccionar servicio..."}</span>
                                    <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50 shrink-0" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Buscar servicio..." className="h-9" />
                                    <CommandList className="max-h-[220px] overflow-y-auto">
                                      <CommandEmpty>No encontrado</CommandEmpty>
                                      <CommandGroup heading="Servicios">
                                        {SERVICE_TYPES.map((st, sIdx) => (
                                          <CommandItem key={`${st.name}-${sIdx}`} value={`${st.name}-${sIdx}`} onSelect={() => {
                                            updateItem(idx, { descripcion: st.name, precio_unitario: st.price, referencia_id: "service" });
                                            closeAccountingCombos();
                                          }}>
                                            <Check className={`h-3 w-3 mr-2 ${item.descripcion === st.name ? "opacity-100" : "opacity-0"}`} />
                                            <Wrench className="h-3 w-3 mr-2 text-muted-foreground" />
                                            <span className="text-xs flex-1">{st.name}</span>
                                            {st.price > 0 && <span className="text-xs font-bold text-primary ml-2">S/.{st.price.toFixed(2)}</span>}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                      <CommandGroup heading="Manual">
                                        <CommandItem value="__manual_serv__" onSelect={() => { updateItem(idx, { referencia_id: null, descripcion: "" }); closeAccountingCombos(); }}>
                                          <Settings2 className="h-3 w-3 mr-2" /> Escribir manualmente
                                        </CommandItem>
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              {!item.referencia_id && (
                                <Input
                                  value={item.descripcion}
                                  onChange={e => updateItem(idx, { descripcion: e.target.value })}
                                  placeholder="Escribir servicio manualmente..."
                                  className="h-8 text-xs mt-1"
                                />
                              )}
                            </>
                          )}
                        </div>


                        <div>
                          <Label className="text-xs text-muted-foreground">Cant.</Label>
                          <Input
                            type="number" min="1"
                            value={item.cantidad}
                            onChange={e => updateItem(idx, { cantidad: parseInt(e.target.value) || 1 })}
                            className="h-9 text-xs"
                          />
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">P. Unit.</Label>
                          <Input
                            type="number" step="0.01" min="0"
                            value={item.precio_unitario}
                            onChange={e => updateItem(idx, { precio_unitario: parseFloat(e.target.value) || 0 })}
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="text-right">
                          <Label className="text-xs text-muted-foreground">Subtotal</Label>
                          <p className="h-9 flex items-center justify-end font-bold text-sm text-primary">
                            S/. {(item.cantidad * item.precio_unitario).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Extra fields for services */}
                      {item.item_type === "servicio" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/50">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Responsable</Label>
                            <Select value={item.responsable || ""} onValueChange={v => updateItem(idx, { responsable: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                              <SelectContent>
                                {staffMembers.map((s: any) => <SelectItem key={s.id} value={s.full_name}>{s.full_name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Tipo de Equipo</Label>
                            <Input value={item.tipo_equipo || ""} onChange={e => updateItem(idx, { tipo_equipo: e.target.value })} placeholder="LAPTOP, IMPRESORA..." className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Diagnóstico</Label>
                            <Input value={item.diagnostico || ""} onChange={e => updateItem(idx, { diagnostico: e.target.value })} placeholder="FALLA FISICA..." className="h-8 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              {items.length > 0 && (
                <div className="bg-secondary/30 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal Productos:</span><span className="font-bold">S/. {itemTotals.productos.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Subtotal Servicios:</span><span className="font-bold">S/. {itemTotals.servicios.toFixed(2)}</span></div>
                  <div className="flex justify-between text-base border-t border-border pt-1 mt-1">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-primary">S/. {itemTotals.total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div><Label>Notas</Label><Input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} /></div>

            {/* Pendiente por cobrar (crédito a entidades) */}
            <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="por_cobrar"
                  checked={form.por_cobrar}
                  onCheckedChange={(v) => setForm({ ...form, por_cobrar: !!v })}
                />
                <Label htmlFor="por_cobrar" className="flex items-center gap-1 cursor-pointer font-semibold text-amber-700 dark:text-amber-300">
                  <Clock className="h-4 w-4" /> Marcar como PENDIENTE POR COBRAR
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground pl-6">
                Use esta opción solo para entidades privadas o públicas a crédito. No aplica al público en general.
              </p>
              {form.por_cobrar && (
                <div className="pl-6">
                  <Label className="text-xs">Tipo de cliente</Label>
                  <Select value={form.tipo_cliente} onValueChange={(v: any) => setForm({ ...form, tipo_cliente: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="publico">Entidad Pública</SelectItem>
                      <SelectItem value="privado">Entidad Privada</SelectItem>
                      <SelectItem value="corporativo">Corporativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Button type="submit" className="gap-2" disabled={saveMutation.isPending || items.length === 0}>
                  {editingId ? "Guardar Cambios" : "Guardar como Borrador"}
                </Button>
                {!editingId && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={saveMutation.isPending || items.length === 0}
                      onClick={() => { setEmitPickerKind("ticket_servicio"); setEmitPickerOpen(true); }}
                    >
                      <FileText className="h-4 w-4" /> Emitir Comprobante
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-primary/40 text-primary"
                      disabled={saveMutation.isPending || items.length === 0}
                      onClick={() => emitNewTransaction("boleta")}
                    >
                      <FileText className="h-4 w-4" /> Emitir Boleta
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-accent/40 text-accent"
                      disabled={saveMutation.isPending || items.length === 0}
                      onClick={() => emitNewTransaction("factura")}
                    >
                      <FileText className="h-4 w-4" /> Emitir Factura
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── EMIT TYPE PICKER ─── */}
      <Dialog open={emitPickerOpen} onOpenChange={setEmitPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Elegir tipo de comprobante
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Selecciona el tipo de comprobante a emitir. Cada tipo lleva su propio correlativo independiente.
            </p>
            <div>
              <Label className="text-xs">Tipo de comprobante</Label>
              <Select value={emitPickerKind} onValueChange={(v) => setEmitPickerKind(v as DocumentKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_KINDS.map(dk => (
                    <SelectItem key={dk.value} value={dk.value}>{dk.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEmitPickerOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  const k = emitPickerKind;
                  setEmitPickerOpen(false);
                  emitNewTransaction(k);
                }}
                className="gap-2"
              >
                <FileText className="h-4 w-4" /> Emitir {DOCUMENT_KINDS.find(d => d.value === emitPickerKind)?.short}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* ─── POST-EMIT PRINT PROMPT ─── */}
      <Dialog open={printPromptOpen} onOpenChange={setPrintPromptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {DOCUMENT_KINDS.find(d => d.value === postEmitDocKind)?.label || "Comprobante"} emitido
              {postEmitTx?.numero_comprobante && <span className="text-primary">N° {postEmitTx.numero_comprobante}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Deseas imprimir el comprobante? Elige el formato:
            </p>
            {postEmitTx && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">N°:</span> <span className="font-mono font-bold text-primary">{postEmitTx.numero_comprobante || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span> <span className="font-bold">{postEmitTx.cliente_nombre || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total:</span> <span className="font-bold text-primary">S/. {Number(postEmitTx.total).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span> <span className="font-bold">{DOCUMENT_KINDS.find(d => d.value === postEmitDocKind)?.label || postEmitTx.tipo_general}</span></div>
              </div>
            )}
            {postEmitTx && (
              <div className="flex justify-center gap-2 pt-2">
                <PrintReceipt
                  order={{
                    id: postEmitTx.id,
                    created_at: postEmitTx.created_at,
                    date: postEmitTx.fecha,
                    numero_comprobante: postEmitTx.numero_comprobante,
                    ticket_number: postEmitTx.numero_comprobante,
                    customer_name: postEmitTx.cliente_nombre || "",
                    customer_phone: postEmitTx.cliente_telefono || "",
                    seller: postEmitTx.emitido_por || "Admin",
                    items: postEmitTx.items!.map(it => ({
                      descripcion: it.descripcion,
                      cantidad: it.cantidad,
                      precio_unitario: it.precio_unitario,
                      subtotal: it.subtotal,
                      item_type: it.item_type,
                      responsable: it.responsable,
                      tipo_equipo: it.tipo_equipo,
                      diagnostico: it.diagnostico,
                    })),
                    subtotal_productos: postEmitTx.subtotal_productos,
                    subtotal_servicios: postEmitTx.subtotal_servicios,
                    total: postEmitTx.total,
                    description: postEmitTx.items!.filter(it => it.item_type === "servicio").map(it => it.descripcion).join(", "),
                    responsible: postEmitTx.items!.find(it => it.responsable)?.responsable || postEmitTx.emitido_por || "",
                    device_type: postEmitTx.items!.find(it => it.tipo_equipo)?.tipo_equipo || "",
                    diagnosis: postEmitTx.items!.find(it => it.diagnostico)?.diagnostico || "",
                    price: postEmitTx.total,
                    product_description: postEmitTx.items!.map(it => `${it.cantidad}x ${it.descripcion}`).join(", "),
                    quantity: postEmitTx.items!.reduce((a, it) => a + it.cantidad, 0),
                    unit_price: postEmitTx.total,
                  }}
                  type={(postEmitDocKind === "ticket_servicio" || postEmitTx.tipo_general === "servicio") ? "service" : "sale"}
                  defaultDocumentKind={postEmitDocKind}
                />
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setPrintPromptOpen(false)}>
                No imprimir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DETAIL DIALOG ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Detalle de Transaccion
            </DialogTitle>
          </DialogHeader>
          {viewingTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Fecha:</span> <span className="font-bold">{viewingTx.fecha}</span></div>
                <div><span className="text-muted-foreground">Estado:</span> <Badge variant={STATUS_MAP[viewingTx.estado]?.variant}>{STATUS_MAP[viewingTx.estado]?.label}</Badge></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-bold capitalize">{viewingTx.tipo_general}</span></div>
                <div><span className="text-muted-foreground">Emitido por:</span> <span className="font-bold">{viewingTx.emitido_por || "—"}</span></div>
                {viewingTx.cliente_nombre && <div className="col-span-2"><span className="text-muted-foreground">Cliente:</span> <span className="font-bold">{viewingTx.cliente_nombre}</span></div>}
                {viewingTx.cliente_telefono && <div><span className="text-muted-foreground">Teléfono:</span> <span className="font-bold">{viewingTx.cliente_telefono}</span></div>}
                {(() => {
                  const notas = viewingTx.notas || "";
                  const dniMatch = notas.match(/DNI:\s*(\d+)/);
                  const pagoMatch = notas.match(/Pago:\s*([^|]+)/);
                  return (<>
                    {dniMatch && <div><span className="text-muted-foreground">DNI:</span> <span className="font-bold">{dniMatch[1]}</span></div>}
                    {pagoMatch && <div><span className="text-muted-foreground">Método Pago:</span> <span className="font-bold">{pagoMatch[1].trim()}</span></div>}
                  </>);
                })()}
              </div>

              {viewingTx.items && viewingTx.items.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descripcion</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">P. Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingTx.items.map((it: any, i: number) => (
                        <React.Fragment key={i}>
                          <TableRow className={it.combo_id && !it.combo_parent_item_id ? "bg-primary/5" : it.combo_parent_item_id ? "bg-muted/30" : ""}>
                            <TableCell>
                              {it.combo_id && !it.combo_parent_item_id ? (
                                <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">🎁 COMBO</Badge>
                              ) : it.combo_parent_item_id ? (
                                <Badge variant="outline" className="text-[10px]">↳</Badge>
                              ) : (
                                <Badge variant={it.item_type === "producto" ? "default" : "secondary"} className="text-xs">
                                  {it.item_type === "producto" ? "Prod." : "Serv."}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className={`font-medium ${it.combo_parent_item_id ? "pl-8 text-muted-foreground italic text-xs" : ""}`}>{it.descripcion}</TableCell>
                            <TableCell className="text-right">{it.cantidad}</TableCell>
                            <TableCell className="text-right">{it.combo_parent_item_id ? "—" : `S/. ${Number(it.precio_unitario).toFixed(2)}`}</TableCell>
                            <TableCell className="text-right font-bold">{it.combo_parent_item_id ? "—" : `S/. ${Number(it.subtotal).toFixed(2)}`}</TableCell>
                          </TableRow>
                          {it.item_type === "servicio" && (it.responsable || it.tipo_equipo || it.diagnostico) && (
                            <TableRow className="bg-secondary/10">
                              <TableCell colSpan={5} className="text-xs text-muted-foreground py-1">
                                {it.responsable && <span className="mr-3">👷 {it.responsable}</span>}
                                {it.tipo_equipo && <span className="mr-3">💻 {it.tipo_equipo}</span>}
                                {it.diagnostico && <span>🔧 {it.diagnostico}</span>}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="bg-secondary/30 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal Productos:</span><span className="font-bold">S/. {Number(viewingTx.subtotal_productos).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Subtotal Servicios:</span><span className="font-bold">S/. {Number(viewingTx.subtotal_servicios).toFixed(2)}</span></div>
                <div className="flex justify-between text-base border-t border-border pt-1 mt-1">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold text-primary">S/. {Number(viewingTx.total).toFixed(2)}</span>
                </div>
              </div>

              {viewingTx.notas && <p className="text-sm text-muted-foreground"><span className="font-bold">Notas:</span> {viewingTx.notas}</p>}

              {viewingTx.estado === "anulado" && viewingTx.motivo_anulacion && (
                <p className="text-sm text-destructive"><span className="font-bold">Motivo anulación:</span> {viewingTx.motivo_anulacion}</p>
              )}

              {viewingTx.estado === "devuelto" && (viewingTx as any).motivo_devolucion && (
                <p className="text-sm text-amber-600"><span className="font-bold">Motivo devolución:</span> {(viewingTx as any).motivo_devolucion}</p>
              )}

              {/* Print button for transactions */}
              {viewingTx.estado !== "anulado" && viewingTx.items && viewingTx.items.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <PrintReceipt
                    order={(() => {
                      const notas = viewingTx.notas || "";
                      const dniMatch = notas.match(/DNI:\s*(\d+)/);
                      const pagoMatch = notas.match(/Pago:\s*([^|]+)/);
                      const montoMatch = notas.match(/Recibido:\s*S\/\.\s*([\d.]+)/);
                      const equipoMatch = notas.match(/Equipo:\s*([^|]+)/);
                      const customerDni = dniMatch ? dniMatch[1] : "";
                      const paymentMethod = pagoMatch ? pagoMatch[1].trim() : "";
                      const amountGiven = montoMatch ? montoMatch[1].trim() : "";
                      const equipoInfo = equipoMatch ? equipoMatch[1].trim() : "";

                      return {
                        id: viewingTx.id,
                        ticket_number: (viewingTx as any).ticket_number || "",
                        created_at: viewingTx.created_at,
                        date: viewingTx.fecha,
                        customer_name: viewingTx.cliente_nombre || "",
                        customer_phone: viewingTx.cliente_telefono || "",
                        customer_dni: customerDni,
                        payment_method: paymentMethod,
                        amount_given: amountGiven,
                        seller: viewingTx.emitido_por || "Admin",
                        equipo: equipoInfo,
                        items: viewingTx.items!.map(it => ({
                          descripcion: it.descripcion,
                          cantidad: it.cantidad,
                          precio_unitario: it.precio_unitario,
                          subtotal: it.subtotal,
                          item_type: it.item_type,
                          responsable: it.responsable,
                          tipo_equipo: it.tipo_equipo,
                          diagnostico: it.diagnostico,
                        })),
                        subtotal_productos: viewingTx.subtotal_productos,
                        subtotal_servicios: viewingTx.subtotal_servicios,
                        total: viewingTx.total,
                        // Legacy fields for service-only
                        description: viewingTx.items!.filter(it => it.item_type === "servicio").map(it => it.descripcion).join(", "),
                        responsible: viewingTx.items!.find(it => it.responsable)?.responsable || viewingTx.emitido_por || "",
                        device_type: viewingTx.items!.find(it => it.tipo_equipo)?.tipo_equipo || "",
                        diagnosis: viewingTx.items!.find(it => it.diagnostico)?.diagnostico || "",
                        price: viewingTx.total,
                        product_description: viewingTx.items!.map(it => `${it.cantidad}x ${it.descripcion}`).join(", "),
                        quantity: viewingTx.items!.reduce((a, it) => a + it.cantidad, 0),
                        unit_price: viewingTx.total,
                      };
                    })()}
                    type={viewingTx.tipo_general === "servicio" ? "service" : "sale"}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    onClick={() => {
                      const tx = viewingTx;
                      const lines: string[] = [];
                      lines.push(`*Comprobante INFOCOM*`);
                      if (tx.numero_comprobante) lines.push(`N° ${tx.numero_comprobante}`);
                      lines.push(`Fecha: ${tx.fecha}`);
                      if (tx.cliente_nombre) lines.push(`Cliente: ${tx.cliente_nombre}`);
                      lines.push("");
                      (tx.items || []).forEach((it: any) => {
                        lines.push(`• ${it.cantidad}x ${it.descripcion} — S/. ${Number(it.subtotal).toFixed(2)}`);
                      });
                      lines.push("");
                      lines.push(`*TOTAL: S/. ${Number(tx.total).toFixed(2)}*`);
                      lines.push("");
                      lines.push("Gracias por su preferencia.");
                      const text = encodeURIComponent(lines.join("\n"));
                      const phone = (tx.cliente_telefono || "").replace(/\D/g, "");
                      const url = phone
                        ? `https://wa.me/${phone.startsWith("51") ? phone : "51" + phone}?text=${text}`
                        : `https://wa.me/?text=${text}`;
                      window.open(url, "_blank");
                    }}
                  >
                    <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── ANULAR DIALOG ─── */}
      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" /> Anular Transaccion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Esta acción no puede deshacerse. La transacción quedará como anulada y el stock se restaurará.</p>
            <div>
              <Label>Motivo de Anulacion</Label>
              <Input value={motivoAnulacion} onChange={e => setMotivoAnulacion(e.target.value)} placeholder="Motivo..." />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAnularOpen(false)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={() => viewingTx && anularMutation.mutate(viewingTx.id)} disabled={anularMutation.isPending}>
                Confirmar Anulacion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DEVOLVER DIALOG ─── */}
      <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="h-5 w-5" /> Marcar como Devuelto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">La venta se contabiliza como devolución. El stock se restaurará.</p>
            <div>
              <Label>Motivo de Devolución</Label>
              <Input value={motivoDevolucion} onChange={e => setMotivoDevolucion(e.target.value)} placeholder="Motivo..." />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDevolverOpen(false)}>Cancelar</Button>
              <Button variant="default" className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={() => viewingTx && devolverMutation.mutate(viewingTx.id)} disabled={devolverMutation.isPending}>
                Confirmar Devolución
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service Types Management Dialog */}
      <Dialog open={serviceTypesOpen} onOpenChange={setServiceTypesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" /> Gestionar Tipos de Servicio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Agrega, edita precios o elimina tipos de servicio. Al seleccionar un servicio en una transacción, el precio se autocompletará.</p>
            
            {/* Add new */}
            <div className="flex gap-2">
              <Input placeholder="Nombre del servicio..." value={newServiceName} onChange={e => setNewServiceName(e.target.value)} className="flex-1 h-9 text-sm" />
              <Input placeholder="Precio" type="number" value={newServicePrice} onChange={e => setNewServicePrice(e.target.value)} className="w-24 h-9 text-sm" />
              <Button size="sm" className="h-9 gap-1" onClick={() => {
                const name = newServiceName.trim();
                if (!name) return;
                if (SERVICE_TYPES.some(s => s.name === name)) { toast.error("Ya existe"); return; }
                saveServiceTypes.mutate([...SERVICE_TYPES, { name, price: Number(newServicePrice) || 0 }]);
                setNewServiceName(""); setNewServicePrice("");
              }}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </div>

            {/* List */}
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {SERVICE_TYPES.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Sin tipos de servicio</p>}
              {SERVICE_TYPES.map((st, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 hover:bg-secondary/30 group">
                  <Wrench className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                  <span className="text-sm flex-1 truncate">{st.name}</span>
                  <Input
                    type="number"
                    value={st.price}
                    onChange={e => {
                      const updated = [...SERVICE_TYPES];
                      updated[idx] = { ...st, price: Number(e.target.value) || 0 };
                      saveServiceTypes.mutate(updated);
                    }}
                    className="w-24 h-7 text-xs text-right"
                    placeholder="Precio"
                  />
                  <span className="text-xs text-muted-foreground">S/.</span>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                    onClick={() => saveServiceTypes.mutate(SERVICE_TYPES.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Total: {SERVICE_TYPES.length} tipos configurados</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountingPage;
