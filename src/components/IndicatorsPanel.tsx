import { useMemo, useState } from "react";
import { GROUP_LABEL } from "../lib/catalog";
import { addDays, fmt, formatDate, monthLabel, today } from "../lib/dates";
import { AGE_FIRST_CALVING, indicators, level, monthlyTrend, type Level, type StockData } from "../lib/stock";
import type { Establishment } from "../lib/types";
import { Card, Input, Select } from "./ui";

const PERIODS = [
  { id: "mes", label: "Este mes" }, { id: "30", label: "30 días" }, { id: "anio", label: "Este año" }, { id: "12m", label: "12 meses" }, { id: "todo", label: "Todo" }, { id: "custom", label: "Elegir fechas" },
] as const;
const LEVEL: Record<Level, { card: string; value: string; chip: string; label: string }> = {
  ok: { card: "border-emerald-200 bg-emerald-50/60", value: "text-emerald-700", chip: "bg-emerald-600 text-white", label: "Bien" },
  warn: { card: "border-amber-200 bg-amber-50/70", value: "text-amber-700", chip: "bg-amber-400 text-amber-950", label: "Atención" },
  bad: { card: "border-rose-200 bg-rose-50/70", value: "text-rose-700", chip: "bg-rose-600 text-white", label: "Revisar" },
  none: { card: "border-[#cad8e3] bg-white", value: "text-slate-800", chip: "bg-slate-200 text-slate-600", label: "Sin datos" },
};

export function IndicatorsPanel({ est, data }: { est: Establishment; data: StockData }) {
  const day = today();
  const [preset, setPreset] = useState<(typeof PERIODS)[number]["id"]>("12m");
  const [custom, setCustom] = useState({ from: addDays(day, -90), to: day });
  const [catId, setCatId] = useState("");
  const range = useMemo(() => {
    if (preset === "custom") return custom;
    const from = preset === "mes" ? day.slice(0, 8) + "01" : preset === "30" ? addDays(day, -29) : preset === "anio" ? day.slice(0, 5) + "01-01" : preset === "12m" ? addDays(day, -364) : est.inventory_date;
    return { from: from < est.inventory_date ? est.inventory_date : from, to: day };
  }, [preset, custom, day, est.inventory_date]);
  const cats = catId ? [catId] : null;
  const r = useMemo(() => indicators(data, range.from, range.to, cats), [data, range, catId]); // eslint-disable-line react-hooks/exhaustive-deps
  const trend = useMemo(() => monthlyTrend(data, day, 12, cats), [data, day, catId]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxBar = Math.max(1, ...trend.map((t) => Math.max(t.entries, t.exits)));
  const s = r.summary;

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold text-brand">Análisis</h1><p className="text-sm text-slate-600">{est.name} · {formatDate(range.from)} al {formatDate(range.to)} ({r.days} días)</p></div>
    <Card className="space-y-2 !p-3">
      <div className="flex flex-wrap gap-1.5">{PERIODS.map((p) => <button key={p.id} onClick={() => setPreset(p.id)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${preset === p.id ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{p.label}</button>)}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={catId} onChange={(e) => setCatId(e.target.value)} className="!mt-0" aria-label="Categoría"><option value="">Todo el rodeo</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        {preset === "custom" ? <>
          <Input type="date" value={custom.from} min={est.inventory_date} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="!mt-0" aria-label="Desde" />
          <Input type="date" value={custom.to} min={custom.from} max={day} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="!mt-0" aria-label="Hasta" />
        </> : null}
      </div>
    </Card>

    <Group title={catId ? "Categoría elegida" : "Rodeo completo"}>
      <Tile title="Stock actual" value={String(r.stock)} lvl="none" info target={`${r.stockH} hembras · ${r.stockM} machos`} detail={`Stock promedio del período: ${fmt(r.avg, 1)}`} />
      <Tile title="Refugo del período" value={`${fmt(r.refugoPct)} %`} lvl="none" info target={`${r.refugo} animales: ${s.exits.venta} ventas, ${s.exits.muerte} muertes, ${s.exits.descarte} descartes`} detail={`Anualizado: ${fmt(r.refugoAnnual)} % · período anterior: ${fmt(r.prevRefugoPct)} %`} />
      <Tile title="Balance del período" value={`${s.balance > 0 ? "+" : ""}${s.balance}`} lvl="none" info target={`Entraron ${s.entries.nacimiento + s.entries.compra + s.entries.ingreso + s.transfersIn} · salieron ${s.exits.venta + s.exits.muerte + s.exits.descarte + s.exits.egreso + s.transfersOut}`} detail={`${s.entries.nacimiento} nacimientos · ${s.entries.compra} compras · ajustes +${s.entries.ingreso}/−${s.exits.egreso}`} />
    </Group>

    {!catId && r.cows.has ? <Group title="Vacas (últimos 12 meses)">
      <Tile title="Refugo anual de vacas" value={`${fmt(r.cows.refugoYear)} %`} lvl={level(r.cows.refugoYear, 25, 30, "max")} target="Meta 20–25 % (4 a 5 lactancias por vaca)" detail="Ventas + muertes + descartes de vacas sobre el promedio de vacas" />
      <Tile title="Mortalidad anual de vacas" value={`${fmt(r.cows.deathYear)} %`} lvl={level(r.cows.deathYear, 6.6, 8.4, "max")} target="Referencia: promedio 6,6 % (encuesta INTA); 8,4–10,3 % en Pampa Húmeda" detail="Muertes de vacas sobre el promedio de vacas" />
      <Tile title="Vacas en ordeñe / vacas totales" value={`${fmt(r.cows.voVt, 0)} %`} lvl={level(r.cows.voVt, 80, 75, "min")} target="Meta 80–85 %" detail={`${r.cows.vo} en ordeñe de ${r.cows.vt} vacas`} />
      <Tile title="Vaquillonas cada 100 vacas" value={fmt(r.cows.heifersPer100, 0)} lvl={r.cows.heifersNeeded === null ? "none" : level(r.cows.heifersPer100, r.cows.heifersNeeded, r.cows.heifersNeeded * 0.85, "min")}
        target={r.cows.heifersNeeded !== null ? `Para mantener el rodeo con este refugo se necesitan ≈ ${fmt(r.cows.heifersNeeded, 0)}` : "Sin datos de refugo"} detail={`${r.cows.heifers} vaquillonas · supone primer parto a los ${AGE_FIRST_CALVING} meses`} />
    </Group> : null}
    {!catId && !r.cows.has ? <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">Para ver los indicadores de vacas (refugo, mortalidad, VO/VT y reposición), asigná el grupo “Vacas en ordeñe”, “Vacas secas” y “Reposición” a tus categorías en Configuración.</p> : null}

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {!catId && r.composition.length ? <Card><p className="font-black">Composición del rodeo hoy</p><Bars items={r.composition.map(([g, n]) => [GROUP_LABEL[g] ?? g, n])} total={r.stock} color="bg-brand" /></Card> : null}
      <Card><p className="font-black">Causas de venta</p>{r.saleCauses.length ? <Bars items={r.saleCauses} total={s.exits.venta} color="bg-amber-500" /> : <p className="mt-2 text-sm text-slate-500">Sin ventas en el período.</p>}</Card>
      <Card><p className="font-black">Causas de muerte</p>{r.deathCauses.length ? <Bars items={r.deathCauses} total={s.exits.muerte} color="bg-rose-500" /> : <p className="mt-2 text-sm text-slate-500">Sin muertes en el período.</p>}</Card>
      <Card>
        <p className="font-black">Últimos 12 meses</p>
        <div className="mt-1 flex gap-4 text-xs font-semibold text-slate-600"><span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-emerald-500" />Entradas</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-rose-500" />Salidas</span></div>
        <ul className="mt-2 space-y-1.5">{trend.map((t) => <li key={t.month} className="grid grid-cols-[48px_1fr_44px] items-center gap-2 text-xs">
          <span className="font-bold text-slate-600">{monthLabel(t.month)}</span>
          <span className="space-y-0.5"><span className="block h-2 rounded-full bg-emerald-500" style={{ width: `${(t.entries / maxBar) * 100}%` }} title={`${t.entries} entradas`} /><span className="block h-2 rounded-full bg-rose-500" style={{ width: `${(t.exits / maxBar) * 100}%` }} title={`${t.exits} salidas`} /></span>
          <span className="text-right font-black">{t.stock}</span>
        </li>)}</ul>
        <p className="mt-1 text-right text-xs text-slate-500">Número: stock a fin de mes</p>
      </Card>
    </div>

    <p className="text-xs leading-5 text-slate-500">
      Referencias: <a className="underline" href="https://bibliotecavirtual.unl.edu.ar/publicaciones/index.php/FAVEAgrarias/article/download/6589/9615/18204" target="_blank" rel="noreferrer">Revista FAVE – UNL</a> (reposición 20–25 % para 4–5 lactancias; en la práctica supera el 30 %) ·{" "}
      <a className="underline" href="https://www.engormix.com/lecheria/vaca-transicion/resultados-encuesta-sobre-manejo_a55416/" target="_blank" rel="noreferrer">Encuesta INTA</a> (mortalidad de vacas promedio 6,6 %) ·{" "}
      <a className="underline" href="https://www.engormix.com/lecheria/gerenciamiento-lecherias/compara-tambo-app-permitira_a42175/" target="_blank" rel="noreferrer">Compará tu tambo</a> (VO/VT óptimo 80–85 %) ·{" "}
      <a className="underline" href="https://www.cargill.com/doc/1432134210278/hf-cow-chart.pdf" target="_blank" rel="noreferrer">Cargill</a> (vaquillonas necesarias según refugo y edad al primer parto).
      Refugo = ventas + muertes + descartes. Los porcentajes se calculan sobre el stock promedio diario del período.
    </p>
  </div>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="text-sm font-black uppercase tracking-wide text-slate-600">{title}</h2><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div></section>;
}
function Tile({ title, value, lvl, target, detail, info }: { title: string; value: string; lvl: Level; target: string; detail: string; info?: boolean }) {
  const s = LEVEL[lvl];
  return <div className={`rounded-2xl border p-4 ${s.card}`}>
    <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-slate-700">{title}</p>{!info ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${s.chip}`}>{s.label}</span> : null}</div>
    <p className={`mt-1 text-3xl font-black ${s.value}`}>{value}</p>
    <p className="text-xs font-semibold text-slate-600">{target}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </div>;
}
function Bars({ items, total, color }: { items: [string, number][]; total: number; color: string }) {
  return <ul className="mt-2 space-y-1.5">{items.slice(0, 8).map(([k, n]) => <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
    <span className="truncate font-semibold">{k}</span><span className="font-black">{n}<span className="ml-1 text-xs font-semibold text-slate-500">{total ? `${Math.round((n / total) * 100)}%` : ""}</span></span>
    <span className="col-span-2 h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full ${color}`} style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></span>
  </li>)}</ul>;
}
