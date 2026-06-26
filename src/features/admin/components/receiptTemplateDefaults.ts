import { DOCUMENT_KINDS } from "@/features/admin/components/PrintReceipt";

export const RECEIPT_VARIABLES = [
  { key: "empresa.nombre", label: "Nombre de la empresa" },
  { key: "empresa.ruc", label: "RUC de la empresa" },
  { key: "empresa.direccion", label: "Dirección de la empresa" },
  { key: "empresa.ciudad", label: "Ciudad" },
  { key: "empresa.telefono", label: "Teléfono empresa" },
  { key: "empresa.email", label: "Email empresa" },
  { key: "empresa.web", label: "Web empresa" },
  { key: "comprobante.titulo", label: "Título del comprobante" },
  { key: "comprobante.numero", label: "N° de comprobante" },
  { key: "comprobante.fecha", label: "Fecha" },
  { key: "comprobante.hora", label: "Hora" },
  { key: "cliente.nombre", label: "Nombre del cliente" },
  { key: "cliente.documento", label: "DNI / RUC del cliente" },
  { key: "cliente.telefono", label: "Teléfono cliente" },
  { key: "cliente.direccion", label: "Dirección cliente" },
  { key: "items_tabla", label: "Tabla de productos/servicios (HTML)" },
  { key: "totales.subtotal", label: "Subtotal" },
  { key: "totales.igv", label: "IGV" },
  { key: "totales.total", label: "TOTAL" },
  { key: "totales.total_letras", label: "Total en letras" },
  { key: "vendedor.nombre", label: "Vendedor / Atendido por" },
  { key: "pago.metodo", label: "Método de pago" },
  { key: "pago.recibido", label: "Efectivo recibido" },
  { key: "pago.vuelto", label: "Vuelto" },
  { key: "notas", label: "Notas adicionales" },
];

export const RECEPCION_VARIABLES = [
  { key: "empresa.nombre", label: "Nombre empresa" },
  { key: "empresa.ruc", label: "RUC empresa" },
  { key: "empresa.direccion", label: "Dirección" },
  { key: "empresa.telefono", label: "Teléfono" },
  { key: "orden.numero", label: "N° de orden" },
  { key: "orden.fecha", label: "Fecha recepción" },
  { key: "orden.fecha_estimada", label: "Fecha estimada entrega" },
  { key: "cliente.nombre", label: "Cliente" },
  { key: "cliente.documento", label: "DNI" },
  { key: "cliente.telefono", label: "Teléfono cliente" },
  { key: "equipo.tipo", label: "Tipo de equipo" },
  { key: "equipo.marca", label: "Marca" },
  { key: "equipo.modelo", label: "Modelo" },
  { key: "equipo.serie", label: "N° de serie" },
  { key: "equipo.accesorios", label: "Accesorios entregados" },
  { key: "equipo.estado", label: "Estado al recibir" },
  { key: "falla.reportada", label: "Falla reportada por el cliente" },
  { key: "diagnostico", label: "Diagnóstico preliminar" },
  { key: "tecnico.nombre", label: "Técnico asignado" },
  { key: "costo.estimado", label: "Costo estimado" },
  { key: "notas", label: "Notas / observaciones" },
];

export const RECEIPT_BLOCKS = [
  {
    name: "📋 Encabezado clásico",
    html: `<table style="border:none;width:100%"><tr><td style="border:none;text-align:left">
<h2 style="margin:0">{{empresa.nombre}}</h2>
<p style="margin:2px 0">RUC: {{empresa.ruc}}</p>
<p style="margin:2px 0">{{empresa.direccion}}</p>
<p style="margin:2px 0">Tel: {{empresa.telefono}}</p>
</td><td style="border:1px solid #000;text-align:center;width:35%;padding:8px">
<strong>{{comprobante.titulo}}</strong><br/>
<span style="font-size:14px">N° {{comprobante.numero}}</span>
</td></tr></table>`,
  },
  {
    name: "👤 Datos del cliente",
    html: `<div style="border:1px solid #ddd;padding:8px;margin:8px 0">
<p style="margin:2px 0"><strong>Cliente:</strong> {{cliente.nombre}}</p>
<p style="margin:2px 0"><strong>Documento:</strong> {{cliente.documento}}</p>
<p style="margin:2px 0"><strong>Teléfono:</strong> {{cliente.telefono}}</p>
<p style="margin:2px 0"><strong>Fecha:</strong> {{comprobante.fecha}} &nbsp; <strong>Hora:</strong> {{comprobante.hora}}</p>
</div>`,
  },
  {
    name: "📦 Tabla de items (automática)",
    html: `<p>{{items_tabla}}</p>`,
  },
  {
    name: "💰 Totales",
    html: `<table style="border:none;width:100%;margin-top:6px"><tr><td style="border:none"></td>
<td style="border:none;text-align:right;width:35%">
<p style="margin:2px 0">Subtotal: <strong>S/ {{totales.subtotal}}</strong></p>
<p style="margin:2px 0">IGV (18%): <strong>S/ {{totales.igv}}</strong></p>
<p style="margin:2px 0;font-size:16px">TOTAL: <strong>S/ {{totales.total}}</strong></p>
</td></tr></table>`,
  },
  {
    name: "🙏 Pie agradecimiento",
    html: `<hr/><p style="text-align:center"><strong>¡Gracias por su compra!</strong></p>
<p style="text-align:center;font-size:11px">Su confianza es nuestro mayor orgullo.</p>`,
  },
  {
    name: "📜 Términos y condiciones",
    html: `<hr/><p style="font-size:10px;text-align:justify"><strong>Condiciones:</strong> Los productos cuentan con garantía del fabricante. Cambios y devoluciones dentro de las 24 horas presentando este comprobante.</p>`,
  },
  {
    name: "🔧 Datos del equipo (servicio técnico)",
    html: `<div style="border:1px solid #ddd;padding:8px;margin:8px 0">
<p style="margin:2px 0"><strong>Equipo:</strong> {{equipo.tipo}} — {{equipo.marca}} {{equipo.modelo}}</p>
<p style="margin:2px 0"><strong>N° Serie:</strong> {{equipo.serie}}</p>
<p style="margin:2px 0"><strong>Accesorios:</strong> {{equipo.accesorios}}</p>
<p style="margin:2px 0"><strong>Estado al recibir:</strong> {{equipo.estado}}</p>
<p style="margin:2px 0"><strong>Falla reportada:</strong> {{falla.reportada}}</p>
</div>`,
  },
];

export const DEFAULT_RECEIPT_HTML = `<table style="border:none;width:100%"><tr>
<td style="border:none;text-align:left">
<h2 style="margin:0;color:#16a34a">{{empresa.nombre}}</h2>
<p style="margin:2px 0;font-size:11px">RUC: {{empresa.ruc}}<br/>{{empresa.direccion}}<br/>Tel: {{empresa.telefono}}</p>
</td>
<td style="border:2px solid #16a34a;text-align:center;width:35%;padding:10px;border-radius:4px">
<strong style="font-size:13px">{{comprobante.titulo}}</strong><br/>
<span style="font-size:16px;font-weight:bold">N° {{comprobante.numero}}</span>
</td></tr></table>
<div style="border:1px solid #ddd;padding:8px;margin:10px 0;background:#f9fafb">
<p style="margin:2px 0"><strong>Cliente:</strong> {{cliente.nombre}} &nbsp;&nbsp; <strong>Doc:</strong> {{cliente.documento}}</p>
<p style="margin:2px 0"><strong>Fecha:</strong> {{comprobante.fecha}} {{comprobante.hora}} &nbsp;&nbsp; <strong>Tel:</strong> {{cliente.telefono}}</p>
</div>
<p>{{items_tabla}}</p>
<table style="border:none;width:100%;margin-top:6px"><tr><td style="border:none"></td>
<td style="border:none;text-align:right;width:40%;background:#f1f5f9;padding:6px;border-radius:4px">
<p style="margin:2px 0">Subtotal: <strong>S/ {{totales.subtotal}}</strong></p>
<p style="margin:2px 0">IGV (18%): <strong>S/ {{totales.igv}}</strong></p>
<p style="margin:4px 0;font-size:16px;color:#16a34a">TOTAL: <strong>S/ {{totales.total}}</strong></p>
</td></tr></table>
<p style="margin-top:4px;font-size:11px"><strong>Atendido por:</strong> {{vendedor.nombre}} &nbsp; <strong>Pago:</strong> {{pago.metodo}}</p>
<hr/>
<p style="text-align:center;margin:4px 0"><strong>¡Gracias por su compra!</strong></p>
<p style="text-align:center;font-size:10px;color:#666">Su confianza es nuestro mayor orgullo.</p>`;

export const DEFAULT_RECEPCION_HTML = `<table style="border:none;width:100%"><tr>
<td style="border:none">
<h2 style="margin:0;color:#16a34a">{{empresa.nombre}}</h2>
<p style="margin:2px 0;font-size:11px">RUC: {{empresa.ruc}} — Tel: {{empresa.telefono}}</p>
</td>
<td style="border:2px solid #16a34a;text-align:center;width:38%;padding:10px;border-radius:4px">
<strong>ORDEN DE SERVICIO</strong><br/>
<span style="font-size:16px;font-weight:bold">N° {{orden.numero}}</span><br/>
<span style="font-size:10px">Fecha: {{orden.fecha}}</span>
</td></tr></table>
<div style="border:1px solid #ddd;padding:8px;margin:10px 0;background:#f9fafb">
<p style="margin:2px 0"><strong>Cliente:</strong> {{cliente.nombre}} — DNI: {{cliente.documento}}</p>
<p style="margin:2px 0"><strong>Teléfono:</strong> {{cliente.telefono}}</p>
</div>
<h3 style="margin:8px 0 4px;color:#0ea5e9">📱 Equipo recibido</h3>
<div style="border:1px solid #ddd;padding:8px">
<p style="margin:2px 0"><strong>Tipo:</strong> {{equipo.tipo}} &nbsp; <strong>Marca:</strong> {{equipo.marca}} &nbsp; <strong>Modelo:</strong> {{equipo.modelo}}</p>
<p style="margin:2px 0"><strong>N° Serie:</strong> {{equipo.serie}}</p>
<p style="margin:2px 0"><strong>Accesorios:</strong> {{equipo.accesorios}}</p>
<p style="margin:2px 0"><strong>Estado al recibir:</strong> {{equipo.estado}}</p>
</div>
<h3 style="margin:8px 0 4px;color:#dc2626">⚠️ Falla reportada</h3>
<p style="border:1px solid #ddd;padding:8px;margin:0">{{falla.reportada}}</p>
<p style="margin-top:8px"><strong>Fecha estimada de entrega:</strong> {{orden.fecha_estimada}} &nbsp; <strong>Costo estimado:</strong> S/ {{costo.estimado}}</p>
<p style="margin:4px 0"><strong>Técnico asignado:</strong> {{tecnico.nombre}}</p>
<hr/>
<p style="font-size:10px;text-align:justify"><strong>Condiciones:</strong> Pasados 30 días sin recoger el equipo, la empresa no se responsabiliza. Presentar este comprobante para retirar el equipo.</p>
<p style="text-align:center;margin-top:16px;font-size:11px">_______________________________<br/>Firma del cliente</p>`;

// ─── Plantilla A4 oficial INFOCOM (réplica del comprobante actual) ───
export const DEFAULT_A4_INFOCOM_HTML = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;padding:20px">
  <table style="border:none;width:100%">
    <tr>
      <td style="border:none;width:55%;vertical-align:top">
        <h1 style="margin:0;color:#2E8B57;font-size:26px;letter-spacing:1px">{{empresa.nombre}}</h1>
        <p style="margin:2px 0;font-size:11px;color:#444">Especialistas en tecnología</p>
        <table style="border:none;width:100%;margin-top:10px;font-size:12px">
          <tr>
            <td style="border:none;padding:2px 8px 2px 0"><b>R.U.C.:</b> {{empresa.ruc}}</td>
            <td style="border:none;padding:2px 0"><b>Tel.:</b> {{empresa.telefono}}</td>
          </tr>
          <tr>
            <td style="border:none;padding:2px 8px 2px 0"><b>{{empresa.ciudad}} - PERÚ</b></td>
            <td style="border:none;padding:2px 0"><b>DIRECCIÓN:</b> {{empresa.direccion}}</td>
          </tr>
        </table>
      </td>
      <td style="border:2px solid #2E8B57;width:35%;text-align:center;padding:14px;border-radius:6px;vertical-align:top">
        <div style="font-weight:700;color:#2E8B57;font-size:14px">{{comprobante.titulo}}</div>
        <div style="height:1px;background:#2E8B57;margin:6px 0"></div>
        <div style="font-size:22px;font-weight:800;letter-spacing:2px">N° {{comprobante.numero}}</div>
      </td>
    </tr>
  </table>

  <div style="border:1px solid #ddd;border-radius:6px;padding:10px;margin:14px 0;background:#fafafa;font-size:12px">
    <p style="margin:2px 0"><b>CLIENTE:</b> {{cliente.nombre}} &nbsp;&nbsp; <b>DNI/RUC:</b> {{cliente.documento}}</p>
    <p style="margin:2px 0"><b>TELÉFONO:</b> {{cliente.telefono}} &nbsp;&nbsp; <b>DIRECCIÓN:</b> {{cliente.direccion}}</p>
    <p style="margin:2px 0"><b>FECHA:</b> {{comprobante.fecha}} &nbsp; <b>HORA:</b> {{comprobante.hora}} &nbsp; <b>VENDEDOR:</b> {{vendedor.nombre}}</p>
  </div>

  <p style="margin:0">{{items_tabla}}</p>

  <table style="border:none;width:100%;margin-top:14px">
    <tr>
      <td style="border:none;vertical-align:top;width:55%;font-size:12px">
        <p style="margin:0"><b>SON:</b> {{totales.total_letras}}</p>
      </td>
      <td style="border:none;width:45%;font-size:12px">
        <table style="border:none;width:100%">
          <tr><td style="border:none;text-align:right;padding:2px 8px">Precio subtotal</td><td style="border:none;text-align:right;width:90px">S/. {{totales.subtotal}}</td></tr>
          <tr><td style="border:none;text-align:right;padding:2px 8px">IGV</td><td style="border:none;text-align:right">S/. {{totales.igv}}</td></tr>
          <tr><td colspan="2" style="border:none;border-top:2px solid #2E8B57;padding-top:4px"></td></tr>
          <tr>
            <td style="border:none;text-align:right;padding:4px 8px;font-size:16px;font-weight:800;color:#2E8B57">IMPORTE TOTAL S/</td>
            <td style="border:none;text-align:right;font-size:16px;font-weight:800;color:#2E8B57">S/. {{totales.total}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <hr style="border:none;border-top:1px dashed #bbb;margin:18px 0"/>

  <div style="text-align:center;font-size:12px;color:#111">
    <p style="margin:2px 0">Si deseas conocer más sobre nuestra variedad</p>
    <p style="margin:2px 0">de productos hazlo ingresando a:</p>
    <p style="margin:6px 0">🌐 <a href="https://{{empresa.web}}" style="color:#2E8B57;text-decoration:underline;font-weight:700">{{empresa.web}}</a></p>
  </div>
</div>`;

export const TEMPLATE_KINDS = [
  ...DOCUMENT_KINDS.map(d => ({
    value: d.value,
    label: d.label,
    group: "Ventas" as const,
    defaultHtml: DEFAULT_RECEIPT_HTML,
    presets: [
      { name: "INFOCOM A4 (oficial)", html: DEFAULT_A4_INFOCOM_HTML, paper_size: "a4" as const },
      { name: "Plantilla en blanco", html: DEFAULT_RECEIPT_HTML, paper_size: "a4" as const },
    ],
    variables: RECEIPT_VARIABLES,
  })),
  {
    value: "recepcion_servicio",
    label: "Recepción de Servicio Técnico",
    group: "Servicio" as const,
    defaultHtml: DEFAULT_RECEPCION_HTML,
    presets: [
      { name: "Plantilla en blanco", html: DEFAULT_RECEPCION_HTML, paper_size: "a4" as const },
    ],
    variables: RECEPCION_VARIABLES,
  },
];
