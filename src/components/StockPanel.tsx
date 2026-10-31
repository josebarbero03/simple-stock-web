import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import type { SaveMovements } from "../hooks/useStockData";
import { GROUP_LABEL, TYPE_PLAIN, canOperate } from "../lib/catalog";
import { formatDate, fmt, today } from "../lib/dates";
import { describeMovement } from "../lib/movements";
import { indicators, stockTable, type StockData } from "../lib/stock";
import type { Establishment, Role } from "../lib/types";
import { MovementWizard, TYPE_STYLE } from "./MovementWizard";
import { Button, Card, Empty } from "./ui";

export function StockPanel({ est, data, role, responsable, save, reload, loading, onGoMovements }: {
  est: Establishment; data: StockData; role: Role; responsable: string; save: SaveMovements; reload: () => Promise<void>; loading: boolean; onGoMovements: () => void;
}) {
  const [wizard, setWizard] = useState(false);
  const day = today();
  const rows = useMemo(() => stockTable(data, day), [data, day]);
  const ind = useMemo(() => indicators(data, day.slice(0, 8) + "01", day), [data, day]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) { const g = r.category.technical_group ?? ""; m.set(g, [...(m.get(g) ?? []), r]); }
    return [...m.entries()];
  }, [rows]);
  const recent = useMemo(() => [...data.movements].sort((a, b) => (b.fecha + (b.hora ?? "")).localeCompare(a.fecha + (a.hora ?? ""))).slice(0, 6), [data.movements]);

  return <div className="space-y-4">
    <section className="rounded-3xl bg-brand-deep p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-bold uppercase tracking-wide text-brand-accent">Stock actual · {formatDate(day)}</p><p className="mt-1 text-6xl font-black leading-none">{total}</p><p className="mt-1 text-emerald-100/80">{ind.stockH} hembras · {ind.stockM} machos</p></div>
        <button onClick={() => void reload()} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Actualizar"><RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      {ind.cows.has && ind.cows.vt ? <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white/10 p-2"><p className="text-2xl font-black">{ind.cows.vo}</p><p className="text-xs text-emerald-100/80">en ordeñe</p></div>
        <div className="rounded-2xl bg-white/10 p-2"><p className="text-2xl font-black">{ind.cows.vt}</p><p className="text-xs text-emerald-100/80">vacas totales</p></div>
        <div className="rounded-2xl bg-white/10 p-2"><p className="text-2xl font-black">{fmt(ind.cows.voVt, 0)}%</p><p className="text-xs text-emerald-100/80">VO / VT</p></div>
      </div> : null}
    </section>

    {canOperate(role) ? <Button onClick={() => setWizard(true)} className="!h-14 w-full !text-lg"><Plus />Registrar movimiento</Button> : null}

    {!rows.length ? <Empty icon={<Plus />} title="Sin categorías" text="Configurá las categorías y el stock inicial en Configuración." />
      : groups.map(([g, list]) => <section key={g} className="space-y-2">
        <h2 className="flex items-baseline justify-between text-sm font-black uppercase tracking-wide text-slate-600"><span>{GROUP_LABEL[g] ?? g}</span><span>{list.reduce((s, r) => s + r.total, 0)}</span></h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">{list.map((r) => <li key={r.category.id} className={`flex items-center gap-3 rounded-2xl border bg-white p-3 ${r.total < 0 ? "border-rose-300" : "border-[#dce5e1]"}`}>
          <div className="min-w-0 flex-1"><p className="truncate font-black">{r.category.name}{!r.category.active ? <span className="ml-2 text-xs font-bold text-slate-400">inactiva</span> : null}</p><p className="text-sm text-slate-500">{r.h} H · {r.m} M</p></div>
          {r.monthChange ? <span className={`flex items-center text-sm font-bold ${r.monthChange > 0 ? "text-emerald-700" : "text-rose-700"}`} title="Cambio desde el comienzo del mes">{r.monthChange > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}{Math.abs(r.monthChange)}</span> : null}
          <span className={`text-3xl font-black ${r.total < 0 ? "text-rose-600" : ""}`}>{r.total}</span>
        </li>)}</ul>
      </section>)}
    {rows.some((r) => r.total < 0) ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">Hay categorías con stock negativo: revisá los movimientos o hacé un conteo mensual para ajustar.</p> : null}

    <Card>
      <div className="flex items-center justify-between"><p className="font-black">Últimos movimientos</p><button onClick={onGoMovements} className="text-sm font-bold text-brand">Ver todos</button></div>
      {!recent.length ? <p className="mt-2 text-sm text-slate-500">Todavía no hay movimientos.</p> : <ul className="mt-2 divide-y divide-[#edf2f0]">{recent.map((m) => <li key={m.id} className="flex items-center gap-3 py-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4 ${TYPE_STYLE[m.tipo].color}`}>{TYPE_STYLE[m.tipo].icon}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{TYPE_PLAIN[m.tipo]} · {describeMovement(m)}</p><p className="truncate text-xs text-slate-500">{formatDate(m.fecha)}{m.causa ? ` · ${m.causa}` : ""}{m.responsable ? ` · ${m.responsable}` : ""}</p></div>
      </li>)}</ul>}
    </Card>

    {wizard ? <MovementWizard establishmentId={est.id} data={data} responsable={responsable} allowAdjustments onSave={save} onClose={() => setWizard(false)} /> : null}
  </div>;
}
