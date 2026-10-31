import { useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { GROUP_LABEL, TYPE_PLAIN } from "../lib/catalog";
import { addDays, fmt, formatDate, today } from "../lib/dates";
import { indicators, stockTable, type StockData } from "../lib/stock";
import type { AgeRange, Establishment } from "../lib/types";
import { ageBuckets } from "../lib/ages";
import { loadAnimals } from "../lib/api";
import { Button, Card, Input } from "./ui";

const csvCell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function download(name: string, rows: unknown[][]) {
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function ExportPanel({ est, data, ageRanges }: { est: Establishment; data: StockData; ageRanges: AgeRange[] }) {
  const day = today();
  const [from, setFrom] = useState(addDays(day, -29) < est.inventory_date ? est.inventory_date : addDays(day, -29));
  const [to, setTo] = useState(day);
  const slug = est.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");

  const exportStock = () => download(`stock-${slug}-${day}.csv`, [["Establecimiento", est.name], ["Fecha", formatDate(day)], [], ["Categoría", "Grupo", "Hembras", "Machos", "Total"], ...stockTable(data, day).map((r) => [r.category.name, GROUP_LABEL[r.category.technical_group ?? ""] ?? r.category.technical_group, r.h, r.m, r.total])]);
  const exportMoves = () => download(`movimientos-${slug}-${from}-a-${to}.csv`, [["Fecha", "Hora", "Tipo", "Origen", "Destino", "Sexo", "Cantidad", "Causa", "Caravana / RP", "Responsable", "Observación"],
    ...data.movements.filter((m) => m.fecha >= from && m.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((m) => [formatDate(m.fecha), m.hora ?? "", m.tipo, m.origen ?? "", m.destino ?? "", m.sexo, m.cantidad, m.causa ?? "", m.rp ?? "", m.responsable ?? "", m.observacion ?? ""])]);
  const exportIndicators = () => {
    const r = indicators(data, from, to);
    download(`indicadores-${slug}-${from}-a-${to}.csv`, [["Establecimiento", est.name], ["Período", `${formatDate(from)} a ${formatDate(to)}`], [],
      ["Stock actual", r.stock], ["Stock promedio", fmt(r.avg)], ["Ventas", r.summary.exits.venta], ["Muertes", r.summary.exits.muerte], ["Descartes", r.summary.exits.descarte],
      ["Refugo %", fmt(r.refugoPct)], ["Refugo anualizado %", fmt(r.refugoAnnual)], ["Nacimientos", r.summary.entries.nacimiento], ["Compras", r.summary.entries.compra],
      ["Refugo anual de vacas %", fmt(r.cows.refugoYear)], ["Mortalidad anual de vacas %", fmt(r.cows.deathYear)], ["VO/VT %", fmt(r.cows.voVt)], ["Vaquillonas cada 100 vacas", fmt(r.cows.heifersPer100, 0)]]);
  };

  async function print() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write("Preparando informe…");
    let ages = "";
    try {
      const ab = ageBuckets((await loadAnimals(est.id)).animals, ageRanges, day);
      ages = `<h2>Animales por días de nacido (${ab.active} con ficha)</h2><table><tr><th>Rango</th><th class="n">Hembras</th><th class="n">Machos</th><th class="n">Total</th></tr>${ab.buckets.map((b) => `<tr><td>${esc(b.range.label)}</td><td class="n">${b.h}</td><td class="n">${b.m}</td><td class="n"><b>${b.total}</b></td></tr>`).join("")}</table>`;
    } catch { ages = ""; }
    w.document.open();
    const rows = stockTable(data, day);
    const r = indicators(data, from, to);
    const moves = data.movements.filter((m) => m.fecha >= from && m.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ${esc(est.name)}</title><style>
      body{font-family:system-ui,sans-serif;color:#10231d;margin:24px}h1{margin:0}h2{margin:24px 0 8px;font-size:16px}table{border-collapse:collapse;width:100%;font-size:12px}
      td,th{border:1px solid #cad8e3;padding:4px 6px;text-align:left}th{background:#e8f2ed}.n{text-align:right}.muted{color:#61706a;font-size:12px}
      .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.kpi div{border:1px solid #cad8e3;border-radius:8px;padding:8px}.kpi b{display:block;font-size:20px}</style></head><body>
      <h1>SInPLe Stock · ${esc(est.name)}</h1><p class="muted">${est.producer_name ? esc(est.producer_name) + " · " : ""}Stock al ${formatDate(day)} · Movimientos e indicadores del ${formatDate(from)} al ${formatDate(to)}</p>
      <div class="kpi"><div>Stock actual<b>${r.stock}</b></div><div>Refugo del período<b>${fmt(r.refugoPct)} %</b></div><div>Refugo anual de vacas<b>${fmt(r.cows.refugoYear)} %</b></div><div>VO/VT<b>${fmt(r.cows.voVt, 0)} %</b></div></div>
      <h2>Stock por categoría</h2><table><tr><th>Categoría</th><th class="n">Hembras</th><th class="n">Machos</th><th class="n">Total</th></tr>${rows.map((x) => `<tr><td>${esc(x.category.name)}</td><td class="n">${x.h}</td><td class="n">${x.m}</td><td class="n"><b>${x.total}</b></td></tr>`).join("")}</table>${ages}
      <h2>Movimientos (${moves.length})</h2><table><tr><th>Fecha</th><th>Tipo</th><th>Origen</th><th>Destino</th><th>Sexo</th><th class="n">Cant.</th><th>Causa</th><th>Responsable</th></tr>${moves.map((m) => `<tr><td>${formatDate(m.fecha)}</td><td>${esc(TYPE_PLAIN[m.tipo])}</td><td>${esc(m.origen ?? "")}</td><td>${esc(m.destino ?? "")}</td><td>${m.sexo}</td><td class="n">${m.cantidad}</td><td>${esc(m.causa ?? "")}</td><td>${esc(m.responsable ?? "")}</td></tr>`).join("")}</table>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold text-brand">Reportes</h1><p className="text-sm text-slate-600">Planillas para Excel e informe para imprimir o guardar en PDF</p></div>
    <Card className="flex flex-wrap items-center gap-3 !p-3"><span className="text-sm font-bold">Período</span>
      <Input type="date" value={from} min={est.inventory_date} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="!mt-0 w-auto" aria-label="Desde" />
      <Input type="date" value={to} min={from} max={day} onChange={(e) => e.target.value && setTo(e.target.value)} className="!mt-0 w-auto" aria-label="Hasta" />
    </Card>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Button variant="secondary" onClick={exportStock} className="!h-14"><FileSpreadsheet />Stock actual (Excel)</Button>
      <Button variant="secondary" onClick={exportMoves} className="!h-14"><FileSpreadsheet />Movimientos del período (Excel)</Button>
      <Button variant="secondary" onClick={exportIndicators} className="!h-14"><FileSpreadsheet />Indicadores del período (Excel)</Button>
      <Button onClick={() => void print()} className="!h-14"><Printer />Informe para imprimir / PDF</Button>
    </div>
    <p className="text-sm text-slate-500">Los archivos se abren con Excel. Para el PDF, en la ventana de impresión elegí “Guardar como PDF”.</p>
  </div>;
}
