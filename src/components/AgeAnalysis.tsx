import { useEffect, useMemo, useState } from "react";
import { ageBuckets } from "../lib/ages";
import { loadAnimals } from "../lib/api";
import { formatDate, today } from "../lib/dates";
import type { StockData } from "../lib/stock";
import type { AgeRange, Animal } from "../lib/types";
import { Card } from "./ui";

/** Animales por días de nacido según los rangos que define el propietario (Configuración → Rangos de edad). */
export function AgeAnalysis({ animals, ranges, data, stock, selected, onSelect }: {
  animals: Animal[] | null; ranges: AgeRange[]; data: StockData; stock?: number; selected?: number | null; onSelect?: (index: number | null) => void;
}) {
  const day = today();
  const r = useMemo(() => ageBuckets(animals ?? [], ranges, day), [animals, ranges, day]);
  const max = Math.max(1, ...r.buckets.map((b) => b.total));
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? "Sin categoría";
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold text-brand">Animales por días de nacido</h2>
      <span className="rounded-full bg-[#eaf2f8] px-3 py-1 text-sm font-bold text-brand">{r.active} con ficha · al {formatDate(day)}</span>
    </div>
    <p className="mt-1 text-sm text-[#667b8d]">Cuenta las fichas individuales activas según su fecha de nacimiento. Los rangos se cambian en Configuración.{stock ? ` Cobertura: ${Math.round((r.active / stock) * 100)} % del stock (${stock}).` : ""}</p>
    {animals === null ? <p className="mt-3 text-sm text-slate-500">Cargando fichas…</p> : !r.active ? <p className="mt-3 rounded-[14px] bg-[#fff2cc] p-3 text-sm">Todavía no hay fichas individuales activas. Cargalas en 🏷️ Animales (con fecha de nacimiento) para ver este análisis.</p>
      : <ul className="mt-3 space-y-2">{r.buckets.map((b, i) => {
        const on = selected === i;
        const body = <>
          <div className="flex items-baseline justify-between gap-2"><span className="text-sm text-[#17324d]">{b.range.label}</span><span className="text-2xl font-bold text-brand">{b.total}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eaf2f8]"><div className="h-full rounded-full bg-[#4f9c57]" style={{ width: `${(b.total / max) * 100}%` }} /></div>
          <div className="mt-1 flex justify-between gap-2 text-xs text-[#667b8d]"><span>H: {b.h}</span><span className="min-w-0 truncate">{b.byCategory.slice(0, 3).map((c) => `${catName(c.id)} ${c.count}`).join(" · ")}</span><span>M: {b.m}</span></div>
        </>;
        const cls = `block w-full rounded-[14px] border p-3 text-left ${on ? "border-brand bg-[#eaf2f8]" : "border-[#cad8e3] bg-white"}`;
        return <li key={b.range.label + i}>{onSelect ? <button type="button" onClick={() => onSelect(on ? null : i)} className={cls} aria-pressed={on}>{body}</button> : <div className={cls}>{body}</div>}</li>;
      })}</ul>}
    {r.withoutDate || r.outside > r.withoutDate ? <p className="mt-2 text-xs text-[#667b8d]">{r.withoutDate ? `${r.withoutDate} sin fecha de nacimiento. ` : ""}{r.outside - r.withoutDate > 0 ? `${r.outside - r.withoutDate} fuera de los rangos definidos.` : ""}</p> : null}
    {onSelect ? <p className="mt-2 text-xs text-[#667b8d]">Tocá un rango para ver esos animales en la lista.</p> : null}
  </Card>;
}

/** Versión que carga las fichas por su cuenta (para Análisis). */
export function AgeAnalysisLoader({ establishmentId, ranges, data, stock }: { establishmentId: string; ranges: AgeRange[]; data: StockData; stock: number }) {
  const [animals, setAnimals] = useState<Animal[] | null>(null);
  useEffect(() => { let live = true; loadAnimals(establishmentId).then((r) => live && setAnimals(r.animals)).catch(() => live && setAnimals([])); return () => { live = false; }; }, [establishmentId]);
  return <AgeAnalysis animals={animals} ranges={ranges} data={data} stock={stock} />;
}
