import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import type { SaveMovements } from "../hooks/useStockData";
import { TYPE_PLAIN, canOperate } from "../lib/catalog";
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
  const recent = useMemo(() => [...data.movements].sort((a, b) => (b.fecha + (b.hora ?? "")).localeCompare(a.fecha + (a.hora ?? ""))).slice(0, 6), [data.movements]);

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2">
      {canOperate(role) ? <Button onClick={() => setWizard(true)} className="!h-12"><Plus />Cargar movimiento</Button> : null}
      <Button variant="secondary" onClick={() => void reload()} className={`!h-12 ${canOperate(role) ? "" : "col-span-2"}`}><RefreshCw className={loading ? "animate-spin" : ""} />Actualizar datos</Button>
    </div>

    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-brand">Stock actual por categoría</h2>
        <span className="rounded-full bg-[#eaf2f8] px-3 py-1 text-sm font-bold text-brand">Total: {total} · al {formatDate(day)}</span>
      </div>
      <p className="mt-1 text-sm text-[#667b8d]">Stock inicial + ingresos − egresos + traslados internos. Separado por sexo.</p>
      {!rows.length ? <div className="mt-3"><Empty icon={<Plus />} title="Sin categorías" text="Configurá las categorías y el stock inicial en Configuración." /></div>
        : <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{rows.map((r) => <li key={r.category.id} className={`rounded-[14px] border p-3 ${r.total < 0 ? "border-rose-300 bg-[#f4cccc]/40" : "border-[#cad8e3] bg-white"}`}>
          <p className="truncate text-sm text-[#667b8d]">{r.category.name}{!r.category.active ? " (inactiva)" : ""}</p>
          <p className={`text-3xl font-bold ${r.total < 0 ? "text-rose-700" : "text-brand"}`}>{r.total}</p>
          <p className="mt-1 flex items-center gap-3 text-xs text-[#667b8d]"><span>H: {r.h}</span>{r.monthChange ? <span className={`flex items-center font-bold ${r.monthChange > 0 ? "text-emerald-700" : "text-rose-700"}`} title="Cambio desde el comienzo del mes">{r.monthChange > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(r.monthChange)} este mes</span> : null}<span className="ml-auto">M: {r.m}</span></p>
        </li>)}</ul>}
    </Card>

    {ind.cows.has && ind.cows.vt ? <Card>
      <h2 className="text-lg font-bold text-brand">Rodeo de vacas</h2>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[14px] bg-[#e2f0d9] p-2"><p className="text-2xl font-bold text-brand">{ind.cows.vo}</p><p className="text-xs text-[#667b8d]">en ordeñe</p></div>
        <div className="rounded-[14px] bg-[#eaf2f8] p-2"><p className="text-2xl font-bold text-brand">{ind.cows.vt}</p><p className="text-xs text-[#667b8d]">vacas totales</p></div>
        <div className="rounded-[14px] bg-[#fff2cc] p-2"><p className="text-2xl font-bold text-brand">{fmt(ind.cows.voVt, 0)}%</p><p className="text-xs text-[#667b8d]">VO / VT</p></div>
      </div>
    </Card> : null}
    {rows.some((r) => r.total < 0) ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">Hay categorías con stock negativo: revisá los movimientos o hacé un conteo mensual para ajustar.</p> : null}

    <Card>
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-brand">Últimos movimientos</h2><button onClick={onGoMovements} className="text-sm font-bold text-brand">Ver todos</button></div>
      {!recent.length ? <p className="mt-2 text-sm text-slate-500">Todavía no hay movimientos.</p> : <ul className="mt-2 divide-y divide-[#e3ecf2]">{recent.map((m) => <li key={m.id} className="flex items-center gap-3 py-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4 ${TYPE_STYLE[m.tipo].color}`}>{TYPE_STYLE[m.tipo].icon}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{TYPE_PLAIN[m.tipo]} · {describeMovement(m)}</p><p className="truncate text-xs text-slate-500">{formatDate(m.fecha)}{m.causa ? ` · ${m.causa}` : ""}{m.responsable ? ` · ${m.responsable}` : ""}</p></div>
      </li>)}</ul>}
    </Card>

    {wizard ? <MovementWizard establishmentId={est.id} data={data} responsable={responsable} allowAdjustments onSave={save} onClose={() => setWizard(false)} /> : null}
  </div>;
}
