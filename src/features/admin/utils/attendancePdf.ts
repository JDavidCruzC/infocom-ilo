import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_SHORT = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const STATUS_FULL: Record<string, string> = { A: "Asistencia", F: "Falta", T: "Tardanza", J: "Justificada", D: "Descanso" };

export interface PdfStaff {
  id: string;
  full_name: string;
  position?: string;
}

export interface PdfRecord {
  date: string; // YYYY-MM-DD
  status?: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  extra_punches?: any;
}

export interface PdfStats {
  a: number; f: number; t: number; j: number; pct: number;
  totalHours: number; scheduledHours: number; overtime: number;
}

interface Options {
  month: number;
  year: number;
  staffList: PdfStaff[];
  recordsByStaff: Record<string, Record<string, PdfRecord>>;
  statsByStaff: Record<string, PdfStats>;
  isRestDay: (staffId: string, dayOfWeek: number) => boolean;
  individual?: boolean;
}

const COLOR_PRIMARY: [number, number, number] = [45, 125, 70];
const COLOR_DARK: [number, number, number] = [22, 27, 34];
const COLOR_LIGHT: [number, number, number] = [240, 246, 252];
const COLOR_MUTED: [number, number, number] = [125, 133, 144];

const formatHours = (h: number) => `${(Math.round(h * 10) / 10).toFixed(1)}h`;

const drawHeader = (doc: jsPDF, title: string, subtitle: string) => {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLOR_DARK);
  doc.rect(0, 0, w, 26, "F");
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 26, w, 2, "F");
  doc.setTextColor(...COLOR_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INFOCOM SOLUCIONES", 14, 12);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(title, 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 200, 195);
  doc.text(subtitle, w - 14, 12, { align: "right" });
  doc.text(`Generado: ${new Date().toLocaleString("es-PE")}`, w - 14, 20, { align: "right" });
};

const drawFooter = (doc: jsPDF) => {
  const total = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR_PRIMARY);
    doc.setLineWidth(0.3);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(`© ${new Date().getFullYear()} INFOCOM SOLUCIONES — Reporte interno`, 14, h - 7);
    doc.text(`Página ${i} de ${total}`, w - 14, h - 7, { align: "right" });
  }
};

const renderStaffSection = (
  doc: jsPDF,
  staff: PdfStaff,
  month: number,
  year: number,
  records: Record<string, PdfRecord>,
  stats: PdfStats,
  isRestDay: (staffId: string, dayOfWeek: number) => boolean,
  isFirst: boolean,
) => {
  if (!isFirst) doc.addPage();
  let y = 36;

  // staff card
  doc.setFillColor(...COLOR_LIGHT);
  doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 18, 2, 2, "F");
  doc.setTextColor(...COLOR_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(staff.full_name, 18, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(staff.position || "—", 18, y + 13);
  y += 24;

  // KPI row
  const kpis: [string, string][] = [
    ["Asistencias", String(stats.a)],
    ["Faltas", String(stats.f)],
    ["Tardanzas", String(stats.t)],
    ["Justif.", String(stats.j)],
    ["% Asist.", `${stats.pct}%`],
    ["Horas Mes", formatHours(stats.totalHours)],
    ["Programadas", formatHours(stats.scheduledHours)],
    ["Extras*", formatHours(stats.overtime)],
  ];
  const colW = (doc.internal.pageSize.getWidth() - 28) / kpis.length;
  kpis.forEach((k, i) => {
    const x = 14 + i * colW;
    doc.setDrawColor(220, 226, 230);
    doc.roundedRect(x + 1, y, colW - 2, 16, 1.5, 1.5, "S");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(k[0], x + colW / 2, y + 5, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(k[1], x + colW / 2, y + 12, { align: "center" });
    doc.setFont("helvetica", "normal");
  });
  y += 22;

  // build daily rows
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows: any[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const rec = records[date];
    const dow = new Date(year, month, d).getDay();
    const rest = isRestDay(staff.id, dow);
    const status = rec?.status || (rest ? "D" : "");
    let hours = 0;
    const addPair = (i?: string | null, o?: string | null) => {
      if (!i || !o) return;
      const [ih, im] = i.split(":").map(Number);
      const [oh, om] = o.split(":").map(Number);
      let diff = (oh + om / 60) - (ih + im / 60);
      if (diff < 0) diff += 24;
      hours += diff;
    };
    addPair(rec?.check_in_time, rec?.check_out_time);
    if (Array.isArray(rec?.extra_punches)) {
      rec!.extra_punches.forEach((p: any) => addPair(p?.in, p?.out));
    }
    rows.push([
      `${DAY_SHORT[dow]} ${String(d).padStart(2, "0")}`,
      STATUS_FULL[status] || "—",
      rec?.check_in_time?.slice(0, 5) || "—",
      rec?.check_out_time?.slice(0, 5) || "—",
      hours > 0 ? formatHours(hours) : "—",
    ]);
  }

  autoTable(doc, {
    head: [["Día", "Estado", "Entrada", "Salida", "Horas"]],
    body: rows,
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5, textColor: COLOR_DARK },
    headStyles: { fillColor: COLOR_PRIMARY, textColor: 255, fontStyle: "bold", halign: "center" },
    bodyStyles: { halign: "center" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 1: { halign: "left" } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, bottom: 18 },
  });
};

export function generateMonthlyAttendancePdf(opts: Options) {
  const { month, year, staffList, recordsByStaff, statsByStaff, isRestDay, individual } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const title = individual
    ? `Reporte individual — ${MONTHS[month]} ${year}`
    : `Reporte general de asistencias — ${MONTHS[month]} ${year}`;
  const subtitle = individual && staffList[0] ? staffList[0].full_name : `${staffList.length} trabajador(es)`;
  drawHeader(doc, title, subtitle);

  staffList.forEach((s, idx) => {
    renderStaffSection(
      doc, s, month, year,
      recordsByStaff[s.id] || {},
      statsByStaff[s.id] || { a: 0, f: 0, t: 0, j: 0, pct: 0, totalHours: 0, scheduledHours: 0, overtime: 0 },
      isRestDay,
      idx === 0,
    );
  });

  // Disclaimer about extras
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    "* La columna de horas extras está pendiente de re-cálculo y revisión técnica. Tomar como referencia.",
    14, h - 16,
  );

  drawFooter(doc);

  const fileName = individual && staffList[0]
    ? `asistencias_${staffList[0].full_name.replace(/\s+/g, "_")}_${MONTHS[month]}_${year}.pdf`
    : `asistencias_general_${MONTHS[month]}_${year}.pdf`;
  doc.save(fileName);
}
