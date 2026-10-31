import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { SaveMovements } from "../hooks/useStockData";
import { formatDate, nowTime, today } from "../lib/dates";
import { stockAt, type StockData } from "../lib/stock";
import type { Establishment, Movement, Sex } from "../lib/types";
import { Button, Card, Input, toast } from "./ui";

type Counts = Record<string, { H: string; M: string }>;

/** Conteo físico / cierre mensual: compara lo contado con el sistema y genera los ajustes (igual que la app Android). */
export function CountPanel({ est, data, responsable, save }: { est: Establishment; data: StockData; responsable: string; save: SaveMovements }) {
  const [date, setDate] = useState(today());
  const cats = useMemo(() => data.categories.filter((c) => c.active || stockAt(data, date, [c.id]) !== 0).sort((a, b) => a.sort_order - b.sort_order), [data, date]);
  const system = (catId: string, s: Sex) => stockAt(data, date, [catId], s);
  const [counts, setCounts] = useState<Counts>({});
  const [saving, setSaving] = useState(false);
  const value = (catId: string, s: Sex) => counts[catId]?.[s] ?? "";
  const diff = (catId: string, s: Sex) => { const v = value(catId, s); return v === "" ? 0 : Math.round(Number(v)) - system(catId, s); };
  const changes = cats.flatMap((c) => (["H", "M"] as Sex[]).map((s) => ({ cat: c, s, d: diff(c.id, s) }))).filter((x) => x.d !== 0);
  const counted = Object.values(counts).some((v) => v.H !== "" || v.M !== "");

  async function apply() {
    if (!changes.length) { toast.error("No hay diferencias para ajustar."); return; }
    const summary = changes.map((x) => `${x.cat.name} ${x.s === "H" ? "hembras" : "machos"}: ${x.d > 0 ? "+" : ""}${x.d}`).join("\n");
    if (!window.confirm(`Se van a registrar estos ajustes al ${formatDate(date)}:\n\n${summary}\n\n¿Confirmás?`)) return;
    setSaving(true);
    const rows: Movement[] = changes.map((x) => ({
      id: crypto.randomUUID(), establishment_id: est.id,
      origin_category_id: x.d < 0 ? x.cat.id : null, destination_category_id: x.d > 0 ? x.cat.id : null,
      origen: x.d < 0 ? x.cat.name : null, destino: x.d > 0 ? x.cat.name : null,
      fecha: date, hora: nowTime(), tipo: x.d > 0 ? "Ingreso ajuste" : "Egreso ajuste", sexo: x.s, cantidad: Math.abs(x.d),
      rp: null, causa: "Conteo físico / cierre mensual", responsable: responsable || null, observacion: "Ajuste generado desde conteo físico mensual",
      updated_at: new Date().toISOString(), deleted_at: null,
    }));
    const r = await save(rows);
    setSaving(false);
    if (r === "error") return;
    toast.ok(`${rows.length} ${rows.length === 1 ? "ajuste registrado" : "ajustes registrados"}`);
    setCounts({});
  }

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-black">Conteo mensual</h1><p className="text-sm text-slate-600">Cargá lo que contaste en el campo. La app compara con el sistema y registra los ajustes necesarios.</p></div>
    <Card className="flex flex-wrap items-center gap-3 !p-3">
      <label className="text-sm font-bold">Fecha del conteo</label>
      <Input type="date" value={date} min={est.inventory_date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} className="!mt-0 w-auto" aria-label="Fecha del conteo" />
      <button onClick={() => setCounts(Object.fromEntries(cats.map((c) => [c.id, { H: String(system(c.id, "H")), M: String(system(c.id, "M")) }])))} className="text-sm font-bold text-brand">Completar con lo del sistema</button>
    </Card>
    <ul className="space-y-2">{cats.map((c) => <li key={c.id} className="rounded-2xl border border-[#dce5e1] bg-white p-3">
      <p className="font-black">{c.name}</p>
      <div className="mt-2 grid grid-cols-[70px_1fr_1fr_1fr] items-center gap-2 text-sm">
        <span /><span className="font-bold text-slate-500">Sistema</span><span className="font-bold text-slate-500">Contado</span><span className="font-bold text-slate-500">Diferencia</span>
        {(["H", "M"] as Sex[]).map((s) => { const d = diff(c.id, s); return [
          <span key={s + "l"} className="font-semibold">{s === "H" ? "Hembras" : "Machos"}</span>,
          <span key={s + "s"} className="text-lg font-black">{system(c.id, s)}</span>,
          <Input key={s + "i"} inputMode="numeric" value={value(c.id, s)} placeholder={String(system(c.id, s))} onChange={(e) => setCounts((x) => ({ ...x, [c.id]: { H: x[c.id]?.H ?? "", M: x[c.id]?.M ?? "", [s]: e.target.value.replace(/\D/g, "") } }))} className="!mt-0 !h-10 text-center text-lg font-bold" aria-label={`${c.name} ${s === "H" ? "hembras" : "machos"} contadas`} />,
          <span key={s + "d"} className={`text-lg font-black ${d > 0 ? "text-emerald-700" : d < 0 ? "text-rose-700" : "text-slate-400"}`}>{d > 0 ? `+${d}` : d}</span>,
        ]; })}
      </div>
    </li>)}</ul>
    <div className="sticky bottom-20 rounded-2xl border border-[#dce5e1] bg-white p-3 shadow-lg sm:bottom-4">
      <p className="mb-2 text-sm text-slate-600">{!counted ? "Cargá al menos una categoría." : changes.length ? <><strong>{changes.length}</strong> diferencias: se registran como “Ingreso ajuste” o “Egreso ajuste” con causa “Conteo físico / cierre mensual”.</> : "El conteo coincide con el sistema."}</p>
      <Button onClick={() => void apply()} loading={saving} disabled={!changes.length} className="w-full"><ClipboardCheck />Registrar ajustes</Button>
    </div>
  </div>;
}
