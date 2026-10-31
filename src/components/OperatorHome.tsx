import { useMemo, useState } from "react";
import { ChevronDown, CloudOff, RefreshCw, Undo2 } from "lucide-react";
import type { SaveMovements } from "../hooks/useStockData";
import { TYPE_PLAIN } from "../lib/catalog";
import { formatDate, greeting, today } from "../lib/dates";
import { describeMovement } from "../lib/movements";
import { stockTable, type StockData } from "../lib/stock";
import type { Establishment, Movement, MovementType } from "../lib/types";
import { MovementWizard, TYPE_STYLE } from "./MovementWizard";
import { toast } from "./ui";

const ACTIONS: MovementType[] = ["Nacimiento", "Muerte", "Venta", "Traslado interno", "Compra", "Descarte"];

/** Pantalla única del operario: botones grandes para lo que pasó en el campo y lo anotado hoy. */
export function OperatorHome({ est, data, responsable, firstName, pending, save, reload, loading }: {
  est: Establishment; data: StockData; userId: string; responsable: string; firstName: string; pending: Movement[]; save: SaveMovements; reload: () => Promise<void>; loading: boolean;
}) {
  const [wizard, setWizard] = useState<MovementType | null>(null);
  const [showStock, setShowStock] = useState(false);
  const day = today();
  const rows = useMemo(() => stockTable(data, day), [data, day]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const pendingIds = new Set(pending.map((m) => m.id));
  const mine = useMemo(() => data.movements.filter((m) => m.fecha === day && (m.responsable ?? "") === responsable).sort((a, b) => (b.hora ?? "").localeCompare(a.hora ?? "")), [data.movements, day, responsable]);

  async function undo(m: Movement) {
    if (!window.confirm(`¿Borrar lo que anotaste?\n${TYPE_PLAIN[m.tipo]} · ${describeMovement(m)}`)) return;
    const r = await save([{ ...m, deleted_at: new Date().toISOString() }]);
    if (r !== "error") toast.ok("Borrado");
  }

  return <div className="space-y-4">
    <section className="rounded-3xl bg-brand-deep p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-2xl font-black">{greeting()}{firstName ? `, ${firstName}` : ""}</p><p className="text-emerald-100/80">{est.name} · {formatDate(day)}</p></div>
        <button onClick={() => void reload()} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Actualizar"><RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      <p className="mt-3 text-lg text-emerald-100/90">Animales en el campo</p>
      <p className="text-6xl font-black leading-none">{total}</p>
    </section>

    <section>
      <h2 className="mb-2 text-2xl font-black">¿Qué pasó?</h2>
      <div className="grid grid-cols-2 gap-3">{ACTIONS.map((t) => <button key={t} onClick={() => setWizard(t)} className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl p-3 text-center text-xl font-black shadow-md active:scale-[.98] [&_svg]:size-10 ${TYPE_STYLE[t].color}`}>{TYPE_STYLE[t].icon}{TYPE_PLAIN[t]}</button>)}</div>
    </section>

    <section className="rounded-3xl bg-white p-4">
      <h2 className="text-xl font-black">Lo que anotaste hoy <span className="text-slate-500">({mine.length})</span></h2>
      {!mine.length ? <p className="mt-2 text-lg text-slate-500">Todavía nada. Tocá un botón de arriba cuando pase algo.</p>
        : <ul className="mt-2 space-y-2">{mine.map((m) => <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-full [&_svg]:size-5 ${TYPE_STYLE[m.tipo].color}`}>{TYPE_STYLE[m.tipo].icon}</span>
          <div className="min-w-0 flex-1"><p className="text-lg font-black">{TYPE_PLAIN[m.tipo]}</p><p className="text-slate-600">{describeMovement(m)}{m.causa ? ` · ${m.causa}` : ""}</p>
            {pendingIds.has(m.id) ? <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900"><CloudOff className="size-3.5" />Sin enviar todavía</span> : null}</div>
          <button onClick={() => void undo(m)} className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-500" aria-label="Deshacer"><Undo2 className="size-5" /></button>
        </li>)}</ul>}
    </section>

    <section>
      <button onClick={() => setShowStock((v) => !v)} className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-lg font-bold">Ver cuántos hay por categoría<ChevronDown className={`size-5 transition ${showStock ? "rotate-180" : ""}`} /></button>
      {showStock ? <ul className="mt-2 space-y-2">{rows.map((r) => <li key={r.category.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3"><span className="text-lg font-bold">{r.category.name}</span><span className="text-3xl font-black">{r.total}</span></li>)}</ul> : null}
    </section>

    {wizard ? <MovementWizard establishmentId={est.id} data={data} responsable={responsable} presetType={wizard} onSave={save} onClose={() => setWizard(null)} /> : null}
  </div>;
}
