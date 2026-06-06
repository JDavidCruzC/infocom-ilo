import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Settings2, FileText, Upload, Loader2, ImageIcon, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const THERMAL_SIZES: Record<string, { label: string; width: string }> = {
  "50mm": { label: "50mm", width: "164px" },
  "58mm": { label: "58mm", width: "200px" },
  "80mm": { label: "80mm", width: "290px" },
};

const PAPER_SIZES: Record<string, { label: string; width: string }> = {
  ...THERMAL_SIZES,
  A4: { label: "A4 (210mm)", width: "700px" },
};

export interface ReceiptTemplate {
  paperSize: string;
  fontSize: string;
  printerType: "thermal" | "a4";
  companyName: string;
  companySubtitle: string;
  footerText: string;
  headerMode: "text" | "logo";
  logoUrl: string;
  receptionTitle: string;
  receptionSectionClient: string;
  receptionSectionDevice: string;
  receptionSectionIssueLabel: string;
  receptionConditionsText: string;
  showEstimatedCost: boolean;
  showConditions: boolean;
  showSignatures: boolean;
  signatureLeft: string;
  signatureRight: string;
  saleTitle: string;
  serviceTitle: string;
  // Per-document-type titles (all editable globally)
  boletaTitle?: string;
  facturaTitle?: string;
  proformaTitle?: string;
  cotizacionTitle?: string;
  notaVentaTitle?: string;
  ticketInternoTitle?: string;
  ticketServicioTitle?: string;
  ticketVentaTitle?: string;
}

export type DocumentKind = "boleta" | "factura" | "proforma" | "cotizacion" | "nota_venta" | "ticket_interno" | "ticket_servicio" | "ticket_venta";

export const DOCUMENT_KINDS: { value: DocumentKind; label: string; short: string; templateKey: keyof ReceiptTemplate }[] = [
  { value: "ticket_servicio", label: "Ticket de Servicio",        short: "T. Servicio", templateKey: "ticketServicioTitle" },
  { value: "ticket_venta",    label: "Ticket de Venta",           short: "T. Venta",    templateKey: "ticketVentaTitle" },
  { value: "boleta",          label: "Boleta de Venta",           short: "Boleta",      templateKey: "boletaTitle" },
  { value: "factura",         label: "Factura",                    short: "Factura",     templateKey: "facturaTitle" },
  { value: "proforma",        label: "Proforma",                   short: "Proforma",    templateKey: "proformaTitle" },
  { value: "cotizacion",      label: "Cotización",                 short: "Cotización",  templateKey: "cotizacionTitle" },
  { value: "nota_venta",      label: "Nota de Venta",              short: "Nota Venta",  templateKey: "notaVentaTitle" },
  { value: "ticket_interno",  label: "Ticket Interno (sin valor fiscal)", short: "Interno", templateKey: "ticketInternoTitle" },
];


export const DEFAULT_TEMPLATE: ReceiptTemplate = {
  paperSize: "58mm",
  fontSize: "12",
  printerType: "thermal",
  companyName: "INFOCOM",
  companySubtitle: "ESPECIALISTAS EN TECNOLOGIA\nSoporte Tecnico Especializado",
  headerMode: "text",
  logoUrl: "",
  footerText: "Gracias por confiar en INFOCOM\nConserve este ticket para recoger su equipo",
  receptionTitle: "TICKET DE RECEPCION",
  receptionSectionClient: "DATOS DEL CLIENTE",
  receptionSectionDevice: "EQUIPO RECIBIDO",
  receptionSectionIssueLabel: "FALLA REPORTADA",
  receptionConditionsText: "NOTA: Todo equipo dejado para revision debera ser retirado en un plazo maximo e improrrogable de 15 dias calendario. Vencido este lapso, la empresa no asume responsabilidad alguna por perdidas, danos, deterioros o fallas posteriores que pudieran presentarse. Asimismo, a partir del dia 16 se generara automaticamente un cargo por concepto de almacenamiento de S/ 1.00 (un sol) por dia, el cual sera obligatorio y debera ser cancelado integramente al momento del retiro del equipo.",
  showEstimatedCost: true,
  showConditions: true,
  showSignatures: true,
  signatureLeft: "Firma del Cliente",
  signatureRight: "Firma del Tecnico",
  saleTitle: "BOLETA DE VENTA",
  serviceTitle: "TICKET DE SERVICIO",
  boletaTitle: "BOLETA DE VENTA",
  facturaTitle: "FACTURA",
  proformaTitle: "PROFORMA",
  cotizacionTitle: "COTIZACIÓN",
  notaVentaTitle: "NOTA DE VENTA",
  ticketInternoTitle: "TICKET INTERNO",
};

const STORE_KEY = "receipt_template";

/** Load template from DB (async) with localStorage fallback for initial render */
export const loadTemplate = (): ReceiptTemplate => {
  try {
    const saved = localStorage.getItem("receipt_template_v2");
    return saved ? { ...DEFAULT_TEMPLATE, ...JSON.parse(saved) } : DEFAULT_TEMPLATE;
  } catch { return DEFAULT_TEMPLATE; }
};

/** Save template to both DB and localStorage */
export const saveTemplateToDb = async (t: ReceiptTemplate) => {
  // Save to localStorage as immediate cache
  localStorage.setItem("receipt_template_v2", JSON.stringify(t));
  // Persist to database
  const { data: existing } = await supabase
    .from("store_settings")
    .select("id")
    .eq("key", STORE_KEY)
    .maybeSingle();

  if (existing) {
    await supabase.from("store_settings").update({ value: t as any }).eq("key", STORE_KEY);
  } else {
    await supabase.from("store_settings").insert({ key: STORE_KEY, value: t as any });
  }
};

/** Load template from DB, falling back to localStorage */
export const loadTemplateFromDb = async (): Promise<ReceiptTemplate> => {
  try {
    const { data } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", STORE_KEY)
      .maybeSingle();

    if (data?.value) {
      const t = { ...DEFAULT_TEMPLATE, ...(data.value as any) };
      // Sync to localStorage
      localStorage.setItem("receipt_template_v2", JSON.stringify(t));
      return t;
    }
  } catch { /* fall through */ }
  return loadTemplate();
};

// Keep backward compat
export const saveTemplate = (t: ReceiptTemplate) => {
  localStorage.setItem("receipt_template_v2", JSON.stringify(t));
  // Fire and forget DB save
  saveTemplateToDb(t).catch(() => {});
};

interface OrderOverrides {
  issueLabel?: string;
  documentKind?: DocumentKind;
}

const loadOrderOverrides = (orderId: string): OrderOverrides => {
  try {
    const saved = localStorage.getItem(`receipt_overrides_${orderId}`);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};

const saveOrderOverrides = (orderId: string, o: OrderOverrides) => {
  localStorage.setItem(`receipt_overrides_${orderId}`, JSON.stringify(o));
};

export interface CompanyReceiptInfo {
  ruc: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  web: string;
  email: string;
  copyright: string;
  saleFooterTitle?: string;       // e.g. "¡Gracias por su compra!"
  saleFooterMessage?: string;     // multi-line, supports \n
  saleFooterShowEmail?: boolean;
  saleFooterShowPhone?: boolean;
  saleFooterShowSocial?: boolean;
  saleFooterSocial?: string;      // e.g. "@infocom.ilo"
}

export const DEFAULT_COMPANY_INFO: CompanyReceiptInfo = {
  ruc: "10479533852",
  direccion: "24 de Octubre Mz 53 Lt 03",
  ciudad: "Ilo - Moquegua - Perú",
  telefono: "963326971",
  web: "www.infocomilo.com",
  email: "infocomcotizaciones@gmail.com",
  copyright: "INFOCOM SOLUCIONES",
  saleFooterTitle: "¡Gracias por su compra!",
  saleFooterMessage: "Su confianza es nuestro mayor orgullo.\nSi tiene alguna pregunta sobre este ticket,\nno dude en comunicarse con nosotros:",
  saleFooterShowEmail: true,
  saleFooterShowPhone: true,
  saleFooterShowSocial: true,
  saleFooterSocial: "@infocom.ilo",
};

let _cachedCompanyInfo: CompanyReceiptInfo | null = null;

export const loadCompanyInfo = async (): Promise<CompanyReceiptInfo> => {
  try {
    const { data } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "receipt_company_info")
      .maybeSingle();
    if (data?.value) {
      _cachedCompanyInfo = { ...DEFAULT_COMPANY_INFO, ...(data.value as any) };
      return _cachedCompanyInfo;
    }
  } catch { /* fall through */ }
  return DEFAULT_COMPANY_INFO;
};

export const getCachedCompanyInfo = (): CompanyReceiptInfo => _cachedCompanyInfo || DEFAULT_COMPANY_INFO;

export const buildCompanyInfoBlock = (ci: CompanyReceiptInfo) =>
  `R.U.C. :${ci.ruc}<br>${ci.ciudad.toUpperCase()}<br>Tel. :${ci.telefono}<br>DIRECCION: ${ci.direccion}<br>${ci.ciudad}<br>${ci.web}`;

export const buildSaleFooter = (ci: CompanyReceiptInfo) => {
  const title = ci.saleFooterTitle || "¡Gracias!";
  const msg = (ci.saleFooterMessage || "").replace(/\n/g, "<br>");
  const lines: string[] = [];
  if (ci.saleFooterShowEmail !== false && ci.email) lines.push(`✉ ${ci.email}`);
  if (ci.saleFooterShowPhone !== false && ci.telefono) lines.push(`☏ ${ci.telefono}`);
  if (ci.saleFooterShowSocial && ci.saleFooterSocial) lines.push(`📱 ${ci.saleFooterSocial}`);
  return `<div style="font-weight:700;font-size:1.05em;margin-bottom:2px">${title}</div>${msg ? `<div style="opacity:.85">${msg}</div>` : ""}${lines.length ? `<div style="margin-top:3px;font-weight:600">${lines.join("<br>")}</div>` : ""}`;
};

export const buildCopyright = (ci: CompanyReceiptInfo) =>
  `© ${new Date().getFullYear()} ${ci.copyright}.`;

// Keep backward compat exports
export const COMPANY_INFO_BLOCK = buildCompanyInfoBlock(DEFAULT_COMPANY_INFO);
export const SALE_FOOTER_TEXT = buildSaleFooter(DEFAULT_COMPANY_INFO);

/** Build the header HTML used in all ticket types */
export const buildHeaderHtml = (t: ReceiptTemplate, includeCompanyInfo = false, ci?: CompanyReceiptInfo) => {
  const info = ci || getCachedCompanyInfo();
  const companyBlock = includeCompanyInfo ? `<div class="company-info">${buildCompanyInfoBlock(info)}</div>` : "";
  if (t.headerMode === "logo" && t.logoUrl) {
    return `<div class="center"><img src="${t.logoUrl}" alt="Logo" style="max-width:80%;max-height:60px;margin:0 auto 4px;display:block" />${companyBlock}<div class="subtitle">${t.companySubtitle.replace(/\n/g, "<br>")}</div></div>`;
  }
  return `<div class="center"><div class="title">${t.companyName}</div>${companyBlock}<div class="subtitle">${t.companySubtitle.replace(/\n/g, "<br>")}</div></div>`;
};

interface PrintReceiptProps {
  order: any;
  type?: "reception" | "sale" | "service";
  defaultDocumentKind?: DocumentKind;
}

const PrintReceipt = ({ order, type = "reception", defaultDocumentKind }: PrintReceiptProps) => {
  const [configOpen, setConfigOpen] = useState(false);
  const [template, setTemplate] = useState<ReceiptTemplate>(loadTemplate);
  const [orderOverrides, setOrderOverrides] = useState<OrderOverrides>(() =>
    order?.id ? loadOrderOverrides(order.id) : {}
  );
  const [uploading, setUploading] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyReceiptInfo>(DEFAULT_COMPANY_INFO);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from DB on mount
  useEffect(() => {
    if (!dbLoaded) {
      Promise.all([loadTemplateFromDb(), loadCompanyInfo()]).then(([t, ci]) => {
        setTemplate(t);
        setCompanyInfo(ci);
        setDbLoaded(true);
      });
    }
  }, [dbLoaded]);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("receipt-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("receipt-assets").getPublicUrl(path);
      updateTemplate({ logoUrl: urlData.publicUrl, headerMode: "logo" });
      toast.success("Logo subido correctamente");
    } catch (err: any) {
      toast.error("Error al subir logo: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePrint = (overridePrinterType?: "thermal" | "a4") => {
    const t = template;
    const pType = overridePrinterType || t.printerType || "thermal";
    const isA4 = pType === "a4";
    const sz = isA4 ? { width: "700px" } : (THERMAL_SIZES[t.paperSize] || THERMAL_SIZES["58mm"]);
    const fs = isA4 ? 11 : (parseInt(t.fontSize) || 12);
    const w = window.open("", "_blank", isA4 ? `width=800,height=900` : `width=400,height=700`);
    if (!w) return;

    let bodyContent = "";
    const issueLabel = orderOverrides.issueLabel || t.receptionSectionIssueLabel;
    const headerHtml = buildHeaderHtml(t);

    // Resolve title for sale/service depending on selected document kind
    const docKind: DocumentKind | undefined = orderOverrides.documentKind || defaultDocumentKind;
    const resolvedSaleTitle = (() => {
      if (type !== "sale") return t.saleTitle;
      if (!docKind) return t.saleTitle;
      const def = DOCUMENT_KINDS.find(d => d.value === docKind);
      return (def && (t[def.templateKey] as string)) || t.saleTitle;
    })();

    // Helper to build items table rows
    const buildItemsRows = () => {
      const items = order.items || [];
      if (items.length > 0) {
        return items.map((it: any, i: number) =>
          `<tr><td class="tc">${i + 1}</td><td class="tc">${it.cantidad}</td><td>UNIDAD</td><td>${String(it.descripcion).toUpperCase()}</td><td class="tr">S/. ${Number(it.precio_unitario).toFixed(2)}</td><td class="tr">S/. ${Number(it.subtotal).toFixed(2)}</td></tr>`
        ).join("");
      }
      return `<tr><td class="tc">1</td><td class="tc">${order.quantity || 1}</td><td>UNIDAD</td><td>${String(order.product_description || order.description || "").toUpperCase()}</td><td class="tr">S/. ${Number(order.unit_price || order.price || 0).toFixed(2)}</td><td class="tr">S/. ${Number(order.total || order.price || 0).toFixed(2)}</td></tr>`;
    };

    const buildItemsRowsSimple = () => {
      const items = order.items || [];
      if (items.length > 0) {
        return items.map((it: any) =>
          `<tr><td class="tc">${it.cantidad}</td><td>${String(it.descripcion).toUpperCase()}</td><td class="tr">S/. ${Number(it.precio_unitario).toFixed(2)}</td><td class="tr">S/. ${Number(it.subtotal).toFixed(2)}</td></tr>`
        ).join("");
      }
      return `<tr><td class="tc">${order.quantity || 1}</td><td>${String(order.product_description || order.description || "").toUpperCase()}</td><td class="tr">S/. ${Number(order.unit_price || order.price || 0).toFixed(2)}</td><td class="tr">S/. ${Number(order.total || order.price || 0).toFixed(2)}</td></tr>`;
    };

    const subtotalProductos = order.subtotal_productos ?? order.total ?? 0;
    const subtotalServicios = order.subtotal_servicios ?? 0;
    const totalFinal = Number(order.total || order.price || 0);

    if (isA4) {
      if (type === "reception") {
        // ─── A4 RECEPTION FORMAT ───
        const a4Header = t.headerMode === "logo" && t.logoUrl
          ? `<img src="${t.logoUrl}" alt="Logo" style="max-height:60px;margin-bottom:4px" />`
          : `<div style="font-size:20px;font-weight:900;letter-spacing:2px">${t.companyName}</div>`;

        bodyContent = `
<div class="a4-container">
  <div class="a4-header">
    <div class="a4-company">
      ${a4Header}
      <div style="font-size:10px;margin-top:2px">${t.companySubtitle.replace(/\n/g, " | ")}</div>
    </div>
    <div class="a4-doc-type">
      <div class="doc-title">${t.receptionTitle}</div>
      <div style="font-size:14px;font-weight:700;margin-top:4px">N° ${order.order_number || ""}</div>
    </div>
  </div>
  <div class="a4-separator"></div>
  <div class="a4-info-grid">
    <div class="a4-info-left">
      <div class="a4-field"><span class="a4-label">Fecha de Recepcion:</span><span>${new Date(order.received_at).toLocaleString("es-PE")}</span></div>
      <div class="a4-field"><span class="a4-label">Cliente:</span><span style="font-weight:700">${order.customer_name || ""}</span></div>
      ${order.customer_phone ? `<div class="a4-field"><span class="a4-label">Telefono:</span><span>${order.customer_phone}</span></div>` : ""}
      ${order.customer_email ? `<div class="a4-field"><span class="a4-label">Email:</span><span>${order.customer_email}</span></div>` : ""}
    </div>
    <div class="a4-info-right">
      <div class="a4-field"><span class="a4-label">Tipo de Equipo:</span><span style="font-weight:700">${order.device_type || ""}</span></div>
      ${order.device_brand ? `<div class="a4-field"><span class="a4-label">Marca:</span><span>${order.device_brand}</span></div>` : ""}
      ${order.device_model ? `<div class="a4-field"><span class="a4-label">Modelo:</span><span>${order.device_model}</span></div>` : ""}
      <div class="a4-field"><span class="a4-label">Accesorios:</span><span>${order.accessories || "No dejo"}</span></div>
    </div>
  </div>
  <div class="a4-separator"></div>
  <table class="a4-items" style="margin-bottom:0">
    <thead><tr><th style="width:35%">${issueLabel}</th><th style="width:35%">DIAGNOSTICO</th><th style="width:30%">REPUESTOS UTILIZADOS</th></tr></thead>
    <tbody><tr>
      <td style="vertical-align:top;min-height:60px;padding:10px 8px">${order.reported_issue || ""}</td>
      <td style="vertical-align:top;padding:10px 8px">${order.diagnosis || "Pendiente"}</td>
      <td style="vertical-align:top;padding:10px 8px">${order.spare_parts || "—"}</td>
    </tr></tbody>
  </table>
  <div class="a4-totals" style="margin-top:12px">
    ${order.estimated_cost ? `<div class="a4-total-row"><span>Costo Estimado:</span><span>S/. ${Number(order.estimated_cost).toFixed(2)}</span></div>` : ""}
    ${order.final_cost ? `<div class="a4-total-row a4-total-final"><span>COSTO FINAL S/</span><span>S/. ${Number(order.final_cost).toFixed(2)}</span></div>` : ""}
  </div>
  ${t.showConditions ? `<div style="margin-top:16px;font-size:9px;text-align:justify;border:1px solid #ccc;padding:8px;border-radius:4px"><strong>CONDICIONES:</strong><br>${t.receptionConditionsText}</div>` : ""}
  ${t.showSignatures ? `<div style="display:flex;justify-content:space-between;margin-top:40px;padding:0 40px">
    <div style="text-align:center;border-top:1px solid #000;min-width:180px;padding-top:4px;font-size:10px">${t.signatureLeft}</div>
    <div style="text-align:center;border-top:1px solid #000;min-width:180px;padding-top:4px;font-size:10px">${t.signatureRight}</div>
  </div>` : ""}
  <div class="a4-footer">
    <p>${t.footerText.replace(/\n/g, "<br>")}</p>
  </div>
</div>`;
      } else {
        // ─── A4 FORMAL BOLETA FORMAT (sale/service) ───
        const ticketType = type === "service" ? t.serviceTitle : resolvedSaleTitle;
        const ticketNum = order.ticket_number || "------";
        const hora = order.created_at ? new Date(order.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "";
        const a4Header = t.headerMode === "logo" && t.logoUrl
          ? `<img src="${t.logoUrl}" alt="Logo" style="max-height:60px;margin-bottom:4px" />`
          : `<div style="font-size:20px;font-weight:900;letter-spacing:2px">${t.companyName}</div>`;

        const isSale = type === "sale";

        bodyContent = `
<div class="a4-container">
  <div class="a4-header">
    <div class="a4-company">
      ${a4Header}
      <div style="font-size:9px;margin-top:4px;line-height:1.5">${buildCompanyInfoBlock(companyInfo)}</div>
    </div>
    <div class="a4-doc-type">
      <div class="doc-title">${ticketType}</div>
      <div style="font-size:14px;font-weight:700;margin-top:4px">N° ${ticketNum}</div>
    </div>
  </div>
  <div class="a4-separator"></div>
  <div class="a4-info-grid">
    <div class="a4-info-left">
      <div class="a4-field"><span class="a4-label">Fecha de Emision:</span><span>${order.date || new Date().toISOString().split("T")[0]}</span></div>
      ${hora ? `<div class="a4-field"><span class="a4-label">Hora:</span><span>${hora}</span></div>` : ""}
      ${order.customer_name ? `<div class="a4-field"><span class="a4-label">Cliente:</span><span>${order.customer_name}</span></div>` : ""}
      ${order.customer_dni ? `<div class="a4-field"><span class="a4-label">D.N.I.:</span><span>${order.customer_dni}</span></div>` : ""}
      ${order.customer_phone ? `<div class="a4-field"><span class="a4-label">Telefono:</span><span>${order.customer_phone}</span></div>` : ""}
    </div>
    <div class="a4-info-right">
      ${isSale && (order.seller || order.emitido_por) ? `<div class="a4-field"><span class="a4-label">Vendedor:</span><span>${String(order.seller || order.emitido_por).toUpperCase()}</span></div>` : ""}
      ${!isSale && order.responsible ? `<div class="a4-field"><span class="a4-label">Responsable:</span><span>${String(order.responsible).toUpperCase()}</span></div>` : ""}
      ${order.payment_method ? `<div class="a4-field"><span class="a4-label">Condicion de Pago:</span><span>${String(order.payment_method).toUpperCase()}</span></div>` : ""}
      ${order.equipo || order.device_type ? `<div class="a4-field"><span class="a4-label">Equipo:</span><span>${String(order.equipo || order.device_type).toUpperCase()}</span></div>` : ""}
    </div>
  </div>
  <table class="a4-items">
    <thead><tr><th>N°</th><th>Cant.</th><th>Unidad</th><th>DESCRIPCION</th><th>P. Unitario</th><th>Total</th></tr></thead>
    <tbody>${buildItemsRows()}</tbody>
  </table>
  <div class="a4-totals">
    ${Number(subtotalProductos) > 0 && Number(subtotalServicios) > 0 ? `
      <div class="a4-total-row"><span>Subtotal Productos:</span><span>S/. ${Number(subtotalProductos).toFixed(2)}</span></div>
      <div class="a4-total-row"><span>Subtotal Servicios:</span><span>S/. ${Number(subtotalServicios).toFixed(2)}</span></div>
    ` : ""}
    <div class="a4-total-row a4-total-final"><span>IMPORTE TOTAL S/</span><span>S/. ${totalFinal.toFixed(2)}</span></div>
  </div>
  ${order.amount_given && Number(order.amount_given) > 0 ? `
  <div class="a4-payment-info">
    <div class="a4-total-row"><span>Monto Recibido:</span><span>S/. ${Number(order.amount_given).toFixed(2)}</span></div>
    <div class="a4-total-row"><span>Vuelto:</span><span>S/. ${(Number(order.amount_given) - totalFinal).toFixed(2)}</span></div>
  </div>` : ""}
  <div class="a4-footer">
    <p>${isSale ? buildSaleFooter(companyInfo) : t.footerText.replace(/\n/g, "<br>")}</p>
    <p style="margin-top:6px;font-size:9px">${buildCopyright(companyInfo)}</p>
  </div>
</div>`;
      }

      const a4Html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${type === "reception" ? t.receptionTitle : (type === "service" ? t.serviceTitle : resolvedSaleTitle)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#000;padding:20px}
  .a4-container{max-width:700px;margin:0 auto;border:1px solid #ccc;padding:24px}
  .a4-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
  .a4-company{flex:1}
  .a4-doc-type{border:2px solid #000;padding:10px 20px;text-align:center;min-width:200px}
  .doc-title{font-size:16px;font-weight:900;letter-spacing:1px}
  .a4-separator{border-top:2px solid #000;margin:8px 0 12px}
  .a4-info-grid{display:flex;gap:20px;margin-bottom:16px}
  .a4-info-left,.a4-info-right{flex:1}
  .a4-field{display:flex;gap:6px;margin:4px 0;font-size:11px}
  .a4-label{font-weight:700;min-width:120px;white-space:nowrap}
  .a4-items{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px}
  .a4-items th{background:#f0f0f0;border:1px solid #999;padding:6px 8px;font-weight:700;text-align:left}
  .a4-items td{border:1px solid #ccc;padding:5px 8px;vertical-align:top}
  .a4-items .tc{text-align:center}
  .a4-items .tr{text-align:right;white-space:nowrap}
  .a4-totals{display:flex;flex-direction:column;align-items:flex-end;margin-top:8px;gap:4px}
  .a4-total-row{display:flex;gap:16px;font-size:12px;min-width:280px;justify-content:space-between}
  .a4-total-final{font-weight:900;font-size:14px;border-top:2px solid #000;padding-top:6px;margin-top:4px}
  .a4-payment-info{display:flex;flex-direction:column;align-items:flex-end;margin-top:6px;gap:2px}
  .a4-footer{text-align:center;margin-top:24px;font-size:10px;color:#555;border-top:1px solid #ccc;padding-top:12px}
  @media print{body{padding:10px}.a4-container{border:none;padding:0}@page{margin:10mm}}
</style></head><body>
${bodyContent}
</body></html>`;

      w.document.write(a4Html);
      w.document.close();
      setTimeout(() => { w.print(); }, 300);
      return;
    }

    // ─── THERMAL TICKET FORMAT ───
    if (type === "reception") {
      bodyContent = `
${headerHtml}
<div class="line"></div>
<div class="center big">#${order.order_number}</div>
<div class="center receipt-title">${t.receptionTitle}</div>
<div class="line"></div>
<div class="row"><span>Fecha:</span><span style="font-size:${Math.max(fs - 1, 8)}px">${new Date(order.received_at).toLocaleString("es-PE")}</span></div>
<div class="line"></div>
<h3>${t.receptionSectionClient}</h3>
<div class="row"><span>Nombre:</span><span class="bold">${order.customer_name}</span></div>
${order.customer_phone ? `<div class="row"><span>Tel:</span><span>${order.customer_phone}</span></div>` : ""}
${order.customer_email ? `<div class="row"><span>Email:</span><span>${order.customer_email}</span></div>` : ""}
<div class="line"></div>
<h3>${t.receptionSectionDevice}</h3>
<div class="row"><span>Tipo:</span><span class="bold">${order.device_type}</span></div>
${order.device_brand ? `<div class="row"><span>Marca:</span><span>${order.device_brand}</span></div>` : ""}
${order.device_model ? `<div class="row"><span>Modelo:</span><span>${order.device_model}</span></div>` : ""}
<div class="row"><span>Acces.:</span><span>${order.accessories || "no dejo"}</span></div>
<div class="line"></div>
<h3>${issueLabel}</h3>
<p style="margin:4px 0;word-break:break-word">${order.reported_issue}</p>
<div class="line"></div>
${t.showEstimatedCost && order.estimated_cost ? `<div class="row"><span>Costo Est.:</span><span class="bold">S/. ${Number(order.estimated_cost).toFixed(2)}</span></div><div class="line"></div>` : ""}
${order.spare_parts ? `<h3>REPUESTOS</h3><p style="margin:4px 0;word-break:break-word">${order.spare_parts}</p><div class="line"></div>` : ""}
${t.showConditions ? `<div class="conditions"><p>${t.receptionConditionsText}</p></div>` : ""}
${t.showSignatures ? `<div class="line"></div><div class="row" style="margin-top:20px"><div style="flex:1;text-align:center;border-top:1px solid #000;margin:0 4px;padding-top:2px"><span style="font-size:${Math.max(fs - 3, 7)}px">${t.signatureLeft}</span></div><div style="flex:1;text-align:center;border-top:1px solid #000;margin:0 4px;padding-top:2px"><span style="font-size:${Math.max(fs - 3, 7)}px">${t.signatureRight}</span></div></div>` : ""}`;
    } else if (type === "sale") {
      const ticketNum = order.ticket_number || "------";
      const hora = order.created_at ? new Date(order.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
      bodyContent = `
${buildHeaderHtml(t, true, companyInfo)}
<div class="line"></div>
<div class="center receipt-title">${resolvedSaleTitle}</div>
<div class="center" style="font-size:${fs}px;font-weight:900">N° ${ticketNum}</div>
<div class="line"></div>
<div class="row"><span>Fecha:</span><span>${order.date}</span></div>
<div class="row"><span>Hora:</span><span>${hora}</span></div>
${order.customer_name ? `<div class="row"><span>Cliente:</span><span class="bold">${order.customer_name}</span></div>` : ""}
${order.customer_phone ? `<div class="row"><span>Tel:</span><span>${order.customer_phone}</span></div>` : ""}
${order.customer_dni ? `<div class="row"><span>DNI:</span><span>${order.customer_dni}</span></div>` : ""}
${order.payment_method ? `<div class="row"><span>Pago:</span><span class="bold">${String(order.payment_method).toUpperCase()}</span></div>` : ""}
<div class="row"><span>Vendedor:</span><span class="bold">${String(order.seller || order.emitido_por || "").toUpperCase()}</span></div>
<div class="line"></div>
<table class="items-table">
<thead><tr><th>Cant.</th><th>Descripcion</th><th>P.U.</th><th>Total</th></tr></thead>
<tbody>${buildItemsRowsSimple()}</tbody>
</table>
<div class="line"></div>
${Number(subtotalProductos) > 0 && Number(subtotalServicios) > 0 ? `<div class="row"><span>Subt. Prod.:</span><span>S/. ${Number(subtotalProductos).toFixed(2)}</span></div><div class="row"><span>Subt. Serv.:</span><span>S/. ${Number(subtotalServicios).toFixed(2)}</span></div>` : ""}
<div class="line"></div>
<div class="row"><span class="bold">TOTAL:</span><span class="bold big">S/. ${totalFinal.toFixed(2)}</span></div>
${order.amount_given && Number(order.amount_given) > 0 ? `<div class="row"><span>Recibido:</span><span>S/. ${Number(order.amount_given).toFixed(2)}</span></div>
<div class="row"><span class="bold">Vuelto:</span><span class="bold">S/. ${(Number(order.amount_given) - totalFinal).toFixed(2)}</span></div>` : ""}`;
    } else {
      bodyContent = `
${headerHtml}
<div class="line"></div>
<div class="center receipt-title">${t.serviceTitle}</div>
<div class="line"></div>
<div class="row"><span>Fecha:</span><span>${order.date}</span></div>
${order.customer_name ? `<div class="row"><span>Cliente:</span><span class="bold">${order.customer_name}</span></div>` : ""}
${order.customer_phone ? `<div class="row"><span>Tel:</span><span>${order.customer_phone}</span></div>` : ""}
${order.customer_dni ? `<div class="row"><span>DNI:</span><span>${order.customer_dni}</span></div>` : ""}
${order.payment_method ? `<div class="row"><span>Pago:</span><span class="bold">${String(order.payment_method).toUpperCase()}</span></div>` : ""}
<div class="row"><span>Resp.:</span><span class="bold">${String(order.responsible || "").toUpperCase()}</span></div>
${order.device_type ? `<div class="row"><span>Equipo:</span><span class="bold">${String(order.device_type).toUpperCase()}</span></div>` : ""}
${order.diagnosis ? `<div class="row"><span>Diag.:</span><span>${order.diagnosis}</span></div>` : ""}
<div class="line"></div>
<table class="items-table">
<thead><tr><th>Cant.</th><th>Descripcion</th><th>P.U.</th><th>Total</th></tr></thead>
<tbody>${buildItemsRowsSimple()}</tbody>
</table>
<div class="line"></div>
${Number(order.subtotal_productos || 0) > 0 && Number(order.subtotal_servicios || 0) > 0 ? `<div class="row"><span>Subt. Prod.:</span><span>S/. ${Number(order.subtotal_productos).toFixed(2)}</span></div><div class="row"><span>Subt. Serv.:</span><span>S/. ${Number(order.subtotal_servicios).toFixed(2)}</span></div>` : ""}
<div class="line"></div>
<div class="row"><span class="bold">TOTAL:</span><span class="bold big">S/. ${totalFinal.toFixed(2)}</span></div>`;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ticket</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:${fs}px;font-weight:700;padding:4px;width:${sz.width};max-width:${sz.width};margin:0 auto;color:#000;overflow:hidden;word-break:break-word}
  .center{text-align:center}
  .bold{font-weight:900}
  .line{border-top:1px dashed #000;margin:4px 0}
  .row{display:flex;justify-content:space-between;margin:1px 0;gap:2px;font-size:${fs}px;overflow:hidden}
  .row span{overflow:hidden;text-overflow:ellipsis}
  .title{font-size:${fs + 3}px;font-weight:900;margin-bottom:2px}
  .receipt-title{font-size:${fs + 1}px;font-weight:900;margin:3px 0;letter-spacing:1px}
  .subtitle{font-size:${Math.max(fs - 2, 7)}px;margin-bottom:4px;font-weight:700}
  h3{font-size:${Math.max(fs - 1, 8)}px;margin:3px 0 1px;text-transform:uppercase;letter-spacing:1px;font-weight:900}
  .footer{margin-top:8px;font-size:${Math.max(fs - 3, 7)}px;text-align:center;font-weight:700}
  .big{font-size:${fs + 4}px;font-weight:900}
  .conditions{margin:6px 0;font-size:${Math.max(fs - 3, 7)}px;font-weight:700;text-align:center}
  .company-info{font-size:${Math.max(fs - 3, 7)}px;margin:4px 0;font-weight:700;line-height:1.4}
  .items-table{width:100%;border-collapse:collapse;margin:3px 0;font-size:${Math.max(fs - 2, 7)}px}
  .items-table th{border-bottom:1px solid #000;padding:1px;text-align:left;font-weight:900;font-size:${Math.max(fs - 2, 7)}px}
  .items-table td{padding:1px;vertical-align:top;word-break:break-word}
  .items-table .tc{text-align:center}
  .items-table .tr{text-align:right;white-space:nowrap}
  @media print{body{padding:2px}@page{margin:1mm}}
</style></head><body>
${bodyContent}
<div class="footer"><p>${type === "sale" ? buildSaleFooter(companyInfo) : t.footerText.replace(/\n/g, "<br>")}</p><p style="margin-top:4px;font-size:${Math.max(fs - 4, 6)}px">${buildCopyright(companyInfo)}</p></div>
</body></html>`;

    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  };

  const updateTemplate = (partial: Partial<ReceiptTemplate>) => {
    const next = { ...template, ...partial };
    setTemplate(next);
    saveTemplate(next);
  };

  const updateOrderOverride = (partial: Partial<OrderOverrides>) => {
    const next = { ...orderOverrides, ...partial };
    setOrderOverrides(next);
    if (order?.id) saveOrderOverrides(order.id, next);
  };

  const currentDocKind: DocumentKind = (orderOverrides.documentKind || defaultDocumentKind || "boleta");

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {type === "sale" && (
        <Select
          value={currentDocKind}
          onValueChange={(v: DocumentKind) => updateOrderOverride({ documentKind: v })}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_KINDS.map(d => (
              <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handlePrint()}>
        <Printer className="h-4 w-4" /> Boletera
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handlePrint("a4")}>
        <FileText className="h-4 w-4" /> A4
      </Button>
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Configurar Ticket</DialogTitle></DialogHeader>
          
          <Tabs defaultValue="order" className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="order">Esta Orden</TabsTrigger>
              <TabsTrigger value="template">Plantilla General</TabsTrigger>
            </TabsList>

            {/* Per-order settings */}
            <TabsContent value="order" className="space-y-4 mt-3">
              {type === "sale" && (
                <div className="space-y-2">
                  <Label className="font-bold">Tipo de Comprobante</Label>
                  <Select
                    value={currentDocKind}
                    onValueChange={(v: DocumentKind) => updateOrderOverride({ documentKind: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_KINDS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">El título del comprobante cambiará al imprimir. Los textos por tipo se editan en "Plantilla General".</p>
                </div>
              )}
              {type === "reception" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="font-bold">Tipo de Ingreso</Label>
                    <Select
                      value={orderOverrides.issueLabel || template.receptionSectionIssueLabel}
                      onValueChange={v => updateOrderOverride({ issueLabel: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FALLA REPORTADA">FALLA REPORTADA (reparacion)</SelectItem>
                        <SelectItem value="SERVICIO SOLICITADO">SERVICIO SOLICITADO (instalacion, etc.)</SelectItem>
                        <SelectItem value="EQUIPO EN REVISION">EQUIPO EN REVISION</SelectItem>
                        <SelectItem value="MANTENIMIENTO">MANTENIMIENTO</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Cambia el titulo de la seccion en el ticket impreso.</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground border-t border-border pt-3">Estas opciones solo afectan el ticket de esta orden especifica.</p>
            </TabsContent>

            {/* Global template */}
            <TabsContent value="template" className="space-y-4 mt-3">
              <div className="space-y-2">
                <Label className="font-bold">Tipo de Impresora por Defecto</Label>
                <Select value={template.printerType || "thermal"} onValueChange={(v: "thermal" | "a4") => updateTemplate({ printerType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thermal">Impresora Boletera (Termica)</SelectItem>
                    <SelectItem value="a4">Impresora Normal (A4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Tamaño Papel Boletera</Label>
                <Select value={template.paperSize} onValueChange={v => updateTemplate({ paperSize: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(THERMAL_SIZES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Tamaño de Fuente Boletera (px)</Label>
                <Input type="number" min="8" max="20" value={template.fontSize} onChange={e => updateTemplate({ fontSize: e.target.value })} />
              </div>

              {/* HEADER: Switch style like signatures */}
              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="font-bold text-sm text-primary">Encabezado del Ticket</h4>
                
                {/* Activar Título */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={template.headerMode === "text"}
                    onCheckedChange={(checked) => {
                      if (checked) updateTemplate({ headerMode: "text" });
                    }}
                  />
                  <Label className="flex items-center gap-2">
                    <Type className="h-4 w-4" /> Activar Título (texto)
                  </Label>
                </div>
                {template.headerMode === "text" && (
                  <div className="ml-8 space-y-2 border-l-2 border-primary/30 pl-3">
                    <Label className="text-xs">Nombre de Empresa</Label>
                    <Input value={template.companyName} onChange={e => updateTemplate({ companyName: e.target.value })} />
                  </div>
                )}

                {/* Activar Logo */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={template.headerMode === "logo"}
                    onCheckedChange={(checked) => {
                      if (checked) updateTemplate({ headerMode: "logo" });
                    }}
                  />
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Activar Logo (imagen)
                  </Label>
                </div>
                {template.headerMode === "logo" && (
                  <div className="ml-8 space-y-3 border-l-2 border-primary/30 pl-3">
                    {template.logoUrl && (
                      <div className="p-3 bg-secondary/30 rounded-lg text-center">
                        <img src={template.logoUrl} alt="Logo actual" className="max-h-14 mx-auto" />
                        <p className="text-xs text-muted-foreground mt-1">Logo actual</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs">Subir logo (PNG sin fondo recomendado)</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadLogo}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? "Subiendo..." : template.logoUrl ? "Cambiar Logo" : "Subir Logo"}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">O pegar URL directamente:</Label>
                      <Input
                        value={template.logoUrl}
                        onChange={e => updateTemplate({ logoUrl: e.target.value })}
                        placeholder="https://..."
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Subtítulo (usar Enter para salto de línea)</Label>
                  <Textarea value={template.companySubtitle} onChange={e => updateTemplate({ companySubtitle: e.target.value })} rows={2} />
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <h4 className="font-bold text-sm text-primary">Títulos de Ticket</h4>
                <div className="space-y-2">
                  <Label>Título - Recepción Técnica</Label>
                  <Input value={template.receptionTitle} onChange={e => updateTemplate({ receptionTitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Título - Boleta de Venta</Label>
                  <Input value={template.saleTitle} onChange={e => updateTemplate({ saleTitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Título - Ticket de Servicio</Label>
                  <Input value={template.serviceTitle} onChange={e => updateTemplate({ serviceTitle: e.target.value })} />
                </div>
                <div className="border-t border-dashed border-border/60 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">📑 Comprobantes de Venta</p>
                  {DOCUMENT_KINDS.map(d => (
                    <div key={d.value} className="space-y-1">
                      <Label className="text-xs">{d.label}</Label>
                      <Input
                        value={(template[d.templateKey] as string) || ""}
                        placeholder={d.label.toUpperCase()}
                        onChange={e => updateTemplate({ [d.templateKey]: e.target.value } as any)}
                      />
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">Estos títulos se aplican según el tipo de comprobante seleccionado en cada venta.</p>
                </div>
              </div>

              {type === "reception" && (
                <div className="border-t border-border pt-3 space-y-3">
                  <h4 className="font-bold text-sm text-primary">Secciones del Ticket de Recepción</h4>
                  <div className="space-y-2">
                    <Label>Sección Cliente</Label>
                    <Input value={template.receptionSectionClient} onChange={e => updateTemplate({ receptionSectionClient: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sección Equipo</Label>
                    <Input value={template.receptionSectionDevice} onChange={e => updateTemplate({ receptionSectionDevice: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sección Falla/Servicio (por defecto)</Label>
                    <Input value={template.receptionSectionIssueLabel} onChange={e => updateTemplate({ receptionSectionIssueLabel: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={template.showEstimatedCost} onCheckedChange={v => updateTemplate({ showEstimatedCost: v })} />
                    <Label>Mostrar Costo Estimado</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={template.showConditions} onCheckedChange={v => updateTemplate({ showConditions: v })} />
                    <Label>Mostrar Nota/Condiciones</Label>
                  </div>
                  {template.showConditions && (
                    <div className="space-y-2">
                      <Label>Texto de Nota/Condiciones</Label>
                      <Textarea value={template.receptionConditionsText} onChange={e => updateTemplate({ receptionConditionsText: e.target.value })} rows={6} className="text-xs" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch checked={template.showSignatures} onCheckedChange={v => updateTemplate({ showSignatures: v })} />
                    <Label>Mostrar Firmas</Label>
                  </div>
                  {template.showSignatures && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Firma Izquierda</Label>
                        <Input value={template.signatureLeft} onChange={e => updateTemplate({ signatureLeft: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Firma Derecha</Label>
                        <Input value={template.signatureRight} onChange={e => updateTemplate({ signatureRight: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-border pt-3 space-y-2">
                <Label className="font-bold">Pie de Ticket (usar Enter para salto de línea)</Label>
                <Textarea value={template.footerText} onChange={e => updateTemplate({ footerText: e.target.value })} rows={2} />
              </div>

              <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs text-primary font-medium">✅ Los cambios se guardan automáticamente en la base de datos y se mantienen permanentemente.</p>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setTemplate(DEFAULT_TEMPLATE); saveTemplate(DEFAULT_TEMPLATE); }}>
                Restaurar Valores por Defecto
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrintReceipt;
