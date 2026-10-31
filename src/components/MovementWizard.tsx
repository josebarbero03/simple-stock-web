import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRightLeft, Ban, Baby, Check, CircleMinus, CirclePlus, HeartCrack, Minus, Plus, RefreshCw, ShoppingCart, Tag, X } from "lucide-react";
import { TYPE_PLAIN, causesFor, needsOrigin } from "../lib/catalog";
import { addDays, formatDate, today } from "../lib/dates";
import { buildMovement, describeMovement, validateDraft, type MovementDraft } from "../lib/movements";
import { stockAt, type StockData } from "../lib/stock";
import type { Movement, MovementType, Sex } from "../lib/types";
import { toast } from "./ui";

export const TYPE_STYLE: Record<MovementType, { icon: React.ReactNode; color: string }> = {
  Nacimiento: { icon: <Baby />, color: "bg-emerald-600 text-white" },
  Compra: { icon: <ShoppingCart />, color: "bg-sky-600 text-white" },
  "Traslado interno": { icon: <ArrowRightLeft />, color: "bg-indigo-600 text-white" },
  Venta: { icon: <Tag />, color: "bg-amber-500 text-amber-950" },
  Muerte: { icon: <HeartCrack />, color: "bg-rose-600 text-white" },
  Descarte: { icon: <Ban />, color: "bg-orange-600 text-white" },
  "Ingreso ajuste": { icon: <CirclePlus />, color: "bg-slate-600 text-white" },
  "Egreso ajuste": { icon: <CircleMinus />, color: "bg-slate-600 text-white" },
};
const OPERATOR_TYPES: MovementType[] = ["Nacimiento", "Muerte", "Venta", "Traslado interno", "Compra", "Descarte"];
const ALL_TYPES: MovementType[] = [...OPERATOR_TYPES, "Ingreso ajuste", "Egreso ajuste"];

type Step = "tipo" | "origen" | "destino" | "sexo" | "cantidad" | "causa" | "resumen" | "listo";

/** Registrar un movimiento paso a paso, con botones grandes. */
export function MovementWizard({ establishmentId, data, responsable, allowAdjustments = false, presetType, onSave, onClose }: {
  establishmentId: string; data: StockData; responsable: string; allowAdjustments?: boolean; presetType?: MovementType;
  onSave: (rows: Movement[]) => Promise<"sent" | "queued" | "error">; onClose: () => void;
}) {
  const categories = useMemo(() => data.categories.filter((c) => c.active).sort((a, b) => a.sort_order - b.sort_order), [data.categories]);
  const [draft, setDraft] = useState<MovementDraft>({ tipo: presetType ?? "Nacimiento", origin: null, destination: null, sexo: "H", cantidad: 1, fecha: today(), causa: "", rp: "", observacion: "" });
  const [history, setHistory] = useState<Step[]>([presetType ? firstStep(presetType) : "tipo"]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"sent" | "queued" | null>(null);
  const step = history[history.length - 1];
  const set = (patch: Partial<MovementDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const go = (s: Step) => setHistory((h) => [...h, s]);
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const today_ = today();
  const count = (catId: string, sex?: Sex) => stockAt(data, today_, [catId], sex);

  function firstStep(t: MovementType): Step { return needsOrigin(t) ? "origen" : "destino"; }
  function afterCategory(t: MovementType, from: "origen" | "destino"): Step {
    if (from === "origen" && t === "Traslado interno") return "destino";
    return "sexo";
  }
  function afterQty(t: MovementType): Step { return causesFor(t).length ? "causa" : "resumen"; }

  function pickCategory(id: string, which: "origen" | "destino") {
    const patch: Partial<MovementDraft> = which === "origen" ? { origin: id } : { destination: id };
    // Si en el origen hay animales de un solo sexo, se elige ese sexo.
    if (which === "origen") { const h = count(id, "H"), m = count(id, "M"); if (h > 0 && m <= 0) patch.sexo = "H"; else if (m > 0 && h <= 0) patch.sexo = "M"; }
    set(patch);
    go(afterCategory(draft.tipo, which));
  }

  const available = draft.origin && needsOrigin(draft.tipo) ? count(draft.origin, draft.sexo) : null;

  async function save(again: boolean) {
    const problem = validateDraft(draft, undefined, data.inventoryDate);
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    const row = buildMovement(draft, establishmentId, data.categories, responsable);
    const r = await onSave([row]);
    setSaving(false);
    if (r === "error") return;
    if (again) {
      toast.ok(r === "queued" ? "Guardado sin señal: se envía cuando vuelva" : `Registrado: ${TYPE_PLAIN[draft.tipo]}`);
      setDraft((d) => ({ ...d, cantidad: 1, causa: "", rp: "", observacion: "" }));
      setHistory([firstStep(draft.tipo)]);
      return;
    }
    setResult(r);
    go("listo");
  }

  const types = allowAdjustments ? ALL_TYPES : OPERATOR_TYPES;
  const title = TYPE_PLAIN[draft.tipo];
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? data.categories.find((c) => c.id === id)?.name ?? "";

  return <div className="fixed inset-0 z-40 overflow-y-auto bg-canvas" role="dialog" aria-modal="true" aria-label="Registrar movimiento">
    <div className="mx-auto max-w-xl space-y-4 p-4 pb-32">
      <div className="flex items-center gap-3">
        {history.length > 1 && step !== "listo" ? <button onClick={back} className="grid size-12 place-items-center rounded-full bg-white" aria-label="Atrás"><ArrowLeft className="size-6" /></button> : null}
        <p className="flex-1 text-lg font-bold text-slate-500">{step !== "tipo" && step !== "listo" ? title : ""}</p>
        <button onClick={onClose} className="grid size-12 place-items-center rounded-full bg-white" aria-label="Cerrar"><X className="size-6" /></button>
      </div>

      {step === "tipo" ? <>
        <h2 className="text-3xl font-black">¿Qué pasó?</h2>
        <div className="grid grid-cols-2 gap-3">{types.map((t) => <button key={t} onClick={() => { set({ tipo: t, origin: null, destination: null, causa: "" }); go(firstStep(t)); }}
          className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center text-xl font-black shadow-sm active:scale-[.98] [&_svg]:size-9 ${TYPE_STYLE[t].color}`}>{TYPE_STYLE[t].icon}{TYPE_PLAIN[t]}</button>)}</div>
      </> : null}

      {step === "origen" || step === "destino" ? <>
        <h2 className="text-3xl font-black">{draft.tipo === "Traslado interno" ? (step === "origen" ? "¿De qué categoría salen?" : "¿A qué categoría pasan?") : step === "origen" ? "¿De qué categoría?" : "¿A qué categoría entran?"}</h2>
        {draft.tipo === "Traslado interno" && step === "destino" ? <p className="text-lg text-slate-600">Salen de <strong>{catName(draft.origin)}</strong></p> : null}
        <div className="grid grid-cols-1 gap-2">{categories.filter((c) => step !== "destino" || c.id !== draft.origin).map((c) => {
          const total = count(c.id);
          return <button key={c.id} onClick={() => pickCategory(c.id, step)} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm active:bg-brand-soft">
            <span className="text-xl font-black">{c.name}</span><span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-lg font-bold text-slate-700">{total}</span>
          </button>;
        })}</div>
      </> : null}

      {step === "sexo" ? <>
        <h2 className="text-3xl font-black">¿Hembras o machos?</h2>
        <div className="grid grid-cols-2 gap-3">{(["H", "M"] as Sex[]).map((s) => <button key={s} onClick={() => { set({ sexo: s }); go("cantidad"); }}
          className={`flex min-h-28 flex-col items-center justify-center rounded-2xl border-4 text-2xl font-black ${draft.sexo === s ? "border-brand bg-brand-soft text-brand-dark" : "border-transparent bg-white"}`}>
          {s === "H" ? "Hembras" : "Machos"}{draft.origin && needsOrigin(draft.tipo) ? <span className="text-base font-bold text-slate-500">hay {count(draft.origin, s)}</span> : null}
        </button>)}</div>
      </> : null}

      {step === "cantidad" ? <>
        <h2 className="text-3xl font-black">¿Cuántos?</h2>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => set({ cantidad: Math.max(1, draft.cantidad - 1) })} className="grid size-20 place-items-center rounded-full bg-white shadow-sm active:bg-slate-100" aria-label="Uno menos"><Minus className="size-10" /></button>
          <input value={draft.cantidad || ""} onChange={(e) => set({ cantidad: Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 0)) })} inputMode="numeric" className="h-24 w-32 rounded-2xl border-2 border-[#cad8e3] bg-white text-center text-6xl font-black outline-none focus:border-brand" aria-label="Cantidad" />
          <button onClick={() => set({ cantidad: draft.cantidad + 1 })} className="grid size-20 place-items-center rounded-full bg-white shadow-sm active:bg-slate-100" aria-label="Uno más"><Plus className="size-10" /></button>
        </div>
        {available !== null && draft.cantidad > available ? <p className="rounded-2xl bg-amber-100 px-4 py-3 text-lg font-bold text-amber-900">Atención: en {catName(draft.origin)} figuran {available} {draft.sexo === "H" ? "hembras" : "machos"}. Revisá la cantidad o la categoría.</p> : null}
        <button disabled={!draft.cantidad} onClick={() => go(afterQty(draft.tipo))} className="h-16 w-full rounded-2xl bg-brand text-2xl font-black text-white disabled:opacity-40">Siguiente</button>
      </> : null}

      {step === "causa" ? <>
        <h2 className="text-3xl font-black">{draft.tipo === "Traslado interno" ? "¿Por qué?" : `¿Causa de la ${draft.tipo.toLowerCase()}?`}</h2>
        <div className="grid grid-cols-1 gap-2">{causesFor(draft.tipo).map((c) => <button key={c} onClick={() => { set({ causa: c }); go("resumen"); }}
          className={`min-h-14 rounded-2xl border-4 px-4 py-3 text-left text-lg font-bold ${draft.causa === c ? "border-brand bg-brand-soft" : "border-transparent bg-white"}`}>{c}</button>)}</div>
        <button onClick={() => { set({ causa: "" }); go("resumen"); }} className="w-full py-3 text-lg font-semibold text-slate-500 underline">No sé / seguir sin causa</button>
      </> : null}

      {step === "resumen" ? <>
        <h2 className="text-3xl font-black">¿Está bien?</h2>
        <div className={`rounded-3xl p-5 ${TYPE_STYLE[draft.tipo].color}`}>
          <p className="flex items-center gap-2 text-2xl font-black [&_svg]:size-8">{TYPE_STYLE[draft.tipo].icon}{title}</p>
          <p className="mt-1 text-xl font-bold">{describeMovement({ tipo: draft.tipo, cantidad: draft.cantidad, sexo: draft.sexo, origen: catName(draft.origin), destino: catName(draft.destination) })}</p>
          {draft.causa ? <p className="mt-1 text-lg opacity-90">{draft.causa}</p> : null}
        </div>
        <div>
          <p className="mb-2 text-xl font-black">¿Cuándo?</p>
          <div className="grid grid-cols-3 gap-2">{[["Hoy", today_], ["Ayer", addDays(today_, -1)]].map(([label, value]) => <button key={label} onClick={() => set({ fecha: value })} className={`min-h-14 rounded-2xl border-4 text-lg font-black ${draft.fecha === value ? "border-brand bg-brand-soft" : "border-transparent bg-white"}`}>{label}</button>)}
            <input type="date" min={data.inventoryDate} max={today_} value={draft.fecha} onChange={(e) => e.target.value && set({ fecha: e.target.value })} className={`min-h-14 rounded-2xl border-4 bg-white px-2 text-base font-bold ${draft.fecha !== today_ && draft.fecha !== addDays(today_, -1) ? "border-brand" : "border-transparent"}`} aria-label="Otra fecha" />
          </div>
          {draft.fecha !== today_ ? <p className="mt-1 text-slate-600">{formatDate(draft.fecha)}</p> : null}
        </div>
        <details className="rounded-2xl bg-white p-4">
          <summary className="cursor-pointer text-lg font-bold text-slate-700">Caravana / lote u observación (opcional)</summary>
          <div className="mt-3 space-y-3">
            <label className="block text-lg font-bold">Caravana, RP o lote<input value={draft.rp} onChange={(e) => set({ rp: e.target.value })} className="mt-1 h-14 w-full rounded-2xl border-2 border-[#cad8e3] px-4 text-xl" /></label>
            <label className="block text-lg font-bold">Observación<textarea value={draft.observacion} onChange={(e) => set({ observacion: e.target.value })} rows={2} className="mt-1 w-full rounded-2xl border-2 border-[#cad8e3] p-3 text-lg" /></label>
          </div>
        </details>
        <button onClick={() => void save(false)} disabled={saving} className="flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-brand text-2xl font-black text-white shadow-lg disabled:opacity-60">{saving ? <RefreshCw className="size-7 animate-spin" /> : <Check className="size-8" />}REGISTRAR</button>
        <button onClick={() => void save(true)} disabled={saving} className="w-full py-2 text-lg font-bold text-brand underline">Registrar y cargar otro igual</button>
      </> : null}

      {step === "listo" ? <div className="space-y-5 pt-10 text-center">
        <span className="mx-auto grid size-24 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-14" /></span>
        <h2 className="text-3xl font-black">¡Registrado!</h2>
        <p className="text-xl text-slate-600">{result === "queued" ? "No hay señal: quedó guardado en el celular y se envía solo cuando vuelva." : describeMovement({ tipo: draft.tipo, cantidad: draft.cantidad, sexo: draft.sexo, origen: catName(draft.origin), destino: catName(draft.destination) })}</p>
        <button onClick={() => { setDraft((d) => ({ ...d, cantidad: 1, causa: "", rp: "", observacion: "", origin: null, destination: null })); setHistory([presetType ? firstStep(presetType) : "tipo"]); setResult(null); }} className="h-16 w-full rounded-2xl bg-white text-xl font-black text-brand-dark">Registrar otro</button>
        <button onClick={onClose} className="h-16 w-full rounded-2xl bg-brand text-2xl font-black text-white">Listo</button>
      </div> : null}
    </div>
  </div>;
}

