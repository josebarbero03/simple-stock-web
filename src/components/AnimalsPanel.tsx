import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Beef, ChevronRight, Plus, Search } from "lucide-react";
import type { SaveMovements } from "../hooks/useStockData";
import { ANIMAL_EVENT_TYPES, ANIMAL_ORIGINS, causesFor } from "../lib/catalog";
import { daysBetween, formatDate, nowTime, today } from "../lib/dates";
import { loadAnimals, upsertAnimal, upsertAnimalEvent } from "../lib/api";
import { buildMovement } from "../lib/movements";
import type { StockData } from "../lib/stock";
import { errorText } from "../lib/supabase";
import type { Animal, AnimalEvent, Establishment, MovementType, Sex } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Select, Textarea, toast } from "./ui";

export const STATUS_LABEL: Record<string, string> = { active: "Activo", sold: "Vendido", dead: "Muerto", discarded: "Descartado" };
const STATUS_FOR: Record<string, string> = { Venta: "sold", Muerte: "dead", Descarte: "discarded" };

function ageText(birth: string) {
  const d = Math.max(0, daysBetween(birth, today()));
  if (d < 60) return `${d} días`;
  if (d < 730) return `${(d / 30.44).toFixed(1).replace(".", ",")} meses`;
  return `${(d / 365.25).toFixed(1).replace(".", ",")} años`;
}

/** Fichas individuales. Como en la app Android, la ficha no cambia el stock salvo que se elija registrar el movimiento. */
export function AnimalsPanel({ est, data, userId, responsable, save }: { est: Establishment; data: StockData; userId: string; responsable: string; save: SaveMovements }) {
  const [animals, setAnimals] = useState<Animal[] | null>(null);
  const [events, setEvents] = useState<AnimalEvent[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? "Sin categoría";

  const load = useCallback(async () => {
    try { const r = await loadAnimals(est.id); setAnimals(r.animals); setEvents(r.events); }
    catch (e) { toast.error(errorText(e, "No se pudieron cargar los animales")); setAnimals([]); }
  }, [est.id]);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (animals ?? []).filter((a) => (status === "todos" || a.status === status) && (!q || [a.tag, a.electronic_tag, a.lot, a.mother_tag].some((v) => v?.toLowerCase().includes(q))));
  }, [animals, query, status]);
  const open = animals?.find((a) => a.id === openId) ?? null;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-brand">Animales</h1><p className="text-sm text-slate-600">Fichas individuales · no modifican el stock general salvo que lo elijas</p></div>
      <Button onClick={() => setCreating(true)}><Plus />Nueva ficha</Button>
    </div>
    <Card className="space-y-3 !p-3">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caravana, electrónica, lote o madre" className="!mt-0 pl-9" aria-label="Buscar" /></div>
      <div className="flex flex-wrap gap-1.5">{[["active", "Activos"], ["sold", "Vendidos"], ["dead", "Muertos"], ["discarded", "Descartados"], ["todos", "Todos"]].map(([id, label]) => <button key={id} onClick={() => setStatus(id)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${status === id ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{label} ({(animals ?? []).filter((a) => id === "todos" || a.status === id).length})</button>)}</div>
    </Card>
    {animals === null ? <p className="text-center text-slate-500">Cargando…</p> : !list.length ? <Empty icon={<Beef />} title="Sin fichas" text="Creá fichas para seguir animales de a uno (pesajes, cambios de categoría, venta o muerte)." />
      : <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">{list.map((a) => <li key={a.id}><button onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 rounded-2xl border border-[#cad8e3] bg-white p-3 text-left">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-black ${a.sexo === "H" ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"}`}>{a.sexo}</span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-lg font-black">{a.tag}</span>{a.status !== "active" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{STATUS_LABEL[a.status] ?? a.status}</span> : null}</span>
          <span className="block truncate text-sm text-slate-500">{catName(a.current_category_id)} · {a.birth_date ? ageText(a.birth_date) : "sin fecha"}{a.lot ? ` · lote ${a.lot}` : ""}</span></span>
        <ChevronRight className="size-5 text-slate-300" />
      </button></li>)}</ul>}
    {creating ? <AnimalForm est={est} data={data} existing={animals ?? []} userId={userId} responsable={responsable} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} /> : null}
    {open ? <AnimalDetail est={est} data={data} animal={open} events={events.filter((e) => e.animal_id === open.id)} userId={userId} responsable={responsable} save={save} onClose={() => setOpenId(null)} onChanged={load} /> : null}
  </div>;
}

function AnimalForm({ est, data, existing, userId, responsable, onClose, onSaved }: { est: Establishment; data: StockData; existing: Animal[]; userId: string; responsable: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({ tag: "", electronic_tag: "", sexo: "H" as Sex, birth_date: today(), mother_tag: "", father_tag: "", origin: ANIMAL_ORIGINS[0], current_category_id: data.categories.find((c) => c.active)?.id ?? "", lot: "", birth_weight: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!f.tag.trim() || !f.birth_date) { toast.error("Completá caravana y fecha de nacimiento."); return; }
    if (existing.some((a) => a.status === "active" && a.tag.trim().toLowerCase() === f.tag.trim().toLowerCase())) { toast.error("Ya existe una ficha activa con esa caravana."); return; }
    if (f.electronic_tag.trim() && existing.some((a) => a.electronic_tag?.trim() === f.electronic_tag.trim())) { toast.error("Ya existe una ficha con esa caravana electrónica."); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const a: Animal = { id: crypto.randomUUID(), establishment_id: est.id, tag: f.tag.trim(), electronic_tag: f.electronic_tag.trim() || null, sexo: f.sexo, birth_date: f.birth_date, mother_tag: f.mother_tag.trim() || null, father_tag: f.father_tag.trim() || null, origin: f.origin, current_category_id: f.current_category_id || null, lot: f.lot.trim() || null, status: "active", birth_weight: f.birth_weight ? Number(f.birth_weight.replace(",", ".")) : null, notes: f.notes.trim() || null, created_by: userId, updated_at: now, deleted_at: null };
    try {
      await upsertAnimal(a);
      await upsertAnimalEvent({ id: crypto.randomUUID(), animal_id: a.id, establishment_id: est.id, event_date: today(), event_time: nowTime(), event_type: "Alta de ficha", category_from_id: null, category_to_id: a.current_category_id, weight: null, cause: null, responsible: responsable || null, notes: "Ficha individual creada sin modificar stock.", movement_id: null, created_by: userId, updated_at: now, deleted_at: null });
      toast.ok(`Ficha ${a.tag} creada`);
      await onSaved();
    } catch (e) { toast.error(errorText(e, "No se pudo guardar")); } finally { setSaving(false); }
  }
  return <Modal title="Nueva ficha" onClose={onClose}>
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Caravana"><Input value={f.tag} onChange={(e) => set({ tag: e.target.value })} autoFocus required /></Field>
        <Field label="Caravana electrónica"><Input value={f.electronic_tag} onChange={(e) => set({ electronic_tag: e.target.value })} /></Field>
        <Field label="Sexo"><Select value={f.sexo} onChange={(e) => set({ sexo: e.target.value as Sex })}><option value="H">Hembra</option><option value="M">Macho</option></Select></Field>
        <Field label="Nacimiento"><Input type="date" max={today()} value={f.birth_date} onChange={(e) => set({ birth_date: e.target.value })} required /></Field>
        <Field label="Categoría"><Select value={f.current_category_id} onChange={(e) => set({ current_category_id: e.target.value })}>{data.categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Origen"><Select value={f.origin} onChange={(e) => set({ origin: e.target.value })}>{ANIMAL_ORIGINS.map((o) => <option key={o}>{o}</option>)}</Select></Field>
        <Field label="Madre"><Input value={f.mother_tag} onChange={(e) => set({ mother_tag: e.target.value })} /></Field>
        <Field label="Padre"><Input value={f.father_tag} onChange={(e) => set({ father_tag: e.target.value })} /></Field>
        <Field label="Lote"><Input value={f.lot} onChange={(e) => set({ lot: e.target.value })} /></Field>
        <Field label="Peso al nacer (kg)"><Input inputMode="decimal" value={f.birth_weight} onChange={(e) => set({ birth_weight: e.target.value })} /></Field>
      </div>
      <Field label="Observaciones"><Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} /></Field>
      <p className="text-xs text-slate-500">Crear la ficha no cambia el stock general.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" loading={saving}>Guardar ficha</Button></div>
    </form>
  </Modal>;
}

function AnimalDetail({ est, data, animal: a, events, userId, responsable, save, onClose, onChanged }: { est: Establishment; data: StockData; animal: Animal; events: AnimalEvent[]; userId: string; responsable: string; save: SaveMovements; onClose: () => void; onChanged: () => Promise<void> }) {
  const [type, setType] = useState(ANIMAL_EVENT_TYPES[0]);
  const [date, setDate] = useState(today());
  const [dest, setDest] = useState("");
  const [weight, setWeight] = useState("");
  const [cause, setCause] = useState("");
  const [notes, setNotes] = useState("");
  const [alsoStock, setAlsoStock] = useState(true);
  const [saving, setSaving] = useState(false);
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? "—";
  const affectsStock = ["Cambio de categoría", "Venta", "Muerte", "Descarte"].includes(type);
  const movementType: MovementType | null = type === "Cambio de categoría" ? "Traslado interno" : type === "Venta" || type === "Muerte" || type === "Descarte" ? type : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (type === "Cambio de categoría" && (!dest || dest === a.current_category_id)) { toast.error("Elegí una categoría distinta a la actual."); return; }
    if (type === "Pesaje" && !(Number(weight.replace(",", ".")) > 0)) { toast.error("Ingresá el peso."); return; }
    if (affectsStock && a.status !== "active") { toast.error("El animal no está activo."); return; }
    setSaving(true);
    const now = new Date().toISOString();
    try {
      let movementId: string | null = null;
      if (alsoStock && movementType && a.current_category_id) {
        const m = buildMovement({ tipo: movementType, origin: a.current_category_id, destination: movementType === "Traslado interno" ? dest : null, sexo: a.sexo, cantidad: 1, fecha: date, causa: cause, rp: a.tag, observacion: notes }, est.id, data.categories, responsable);
        const r = await save([m]);
        if (r === "error") { setSaving(false); return; }
        movementId = m.id;
      }
      await upsertAnimalEvent({ id: crypto.randomUUID(), animal_id: a.id, establishment_id: est.id, event_date: date, event_time: nowTime(), event_type: type, category_from_id: affectsStock ? a.current_category_id : null, category_to_id: type === "Cambio de categoría" ? dest : null, weight: type === "Pesaje" ? Number(weight.replace(",", ".")) : null, cause: cause.trim() || null, responsible: responsable || null, notes: notes.trim() || null, movement_id: movementId, created_by: userId, updated_at: now, deleted_at: null });
      if (type === "Cambio de categoría" || STATUS_FOR[type]) await upsertAnimal({ ...a, current_category_id: type === "Cambio de categoría" ? dest : a.current_category_id, status: STATUS_FOR[type] ?? a.status, updated_at: now });
      toast.ok(movementId ? `${type} registrado en la ficha y en el stock` : `${type} registrado`);
      setWeight(""); setCause(""); setNotes("");
      await onChanged();
    } catch (e) { toast.error(errorText(e, "No se pudo guardar")); } finally { setSaving(false); }
  }

  return <Modal title={`Animal ${a.tag}`} onClose={onClose}>
    <p className="-mt-3 mb-3 text-sm text-slate-500">{a.sexo === "H" ? "Hembra" : "Macho"} · {a.birth_date ? `${ageText(a.birth_date)} (nac. ${formatDate(a.birth_date)})` : "sin fecha"} · {catName(a.current_category_id)} · {STATUS_LABEL[a.status] ?? a.status}</p>
    <div className="mb-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
      {a.electronic_tag ? <span>Electrónica: <b>{a.electronic_tag}</b></span> : null}{a.mother_tag ? <span>Madre: <b>{a.mother_tag}</b></span> : null}{a.father_tag ? <span>Padre: <b>{a.father_tag}</b></span> : null}{a.lot ? <span>Lote: <b>{a.lot}</b></span> : null}<span>Origen: <b>{a.origin}</b></span>{a.birth_weight ? <span>Peso al nacer: <b>{a.birth_weight} kg</b></span> : null}
    </div>
    {a.status === "active" ? <form onSubmit={submit} className="space-y-3 rounded-2xl bg-slate-50 p-3">
      <p className="font-black">Registrar evento</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><Select value={type} onChange={(e) => setType(e.target.value)}>{ANIMAL_EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Fecha"><Input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {type === "Cambio de categoría" ? <Field label="Nueva categoría"><Select value={dest} onChange={(e) => setDest(e.target.value)}><option value="">Elegí…</option>{data.categories.filter((c) => c.active && c.id !== a.current_category_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field> : null}
        {type === "Pesaje" ? <Field label="Peso (kg)"><Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field> : null}
        {movementType && movementType !== "Traslado interno" ? <Field label="Causa"><Input list="animal-causes" value={cause} onChange={(e) => setCause(e.target.value)} /></Field> : null}
      </div>
      <datalist id="animal-causes">{movementType ? causesFor(movementType).map((c) => <option key={c} value={c} />) : null}</datalist>
      <Field label="Observación"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {affectsStock ? <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" checked={alsoStock} onChange={(e) => setAlsoStock(e.target.checked)} className="mt-0.5 size-4 accent-[#123b5d]" />Registrar también en el stock general (1 {a.sexo === "H" ? "hembra" : "macho"} de {catName(a.current_category_id)})</label> : null}
      <div className="flex justify-end"><Button type="submit" loading={saving}>Registrar</Button></div>
    </form> : null}
    <div className="mt-4"><p className="mb-2 text-sm font-black text-slate-700">Historial</p>
      {!events.length ? <p className="text-sm text-slate-500">Sin eventos.</p> : <ul className="space-y-1.5">{events.map((e) => <li key={e.id} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-[#e3ecf2]">
        <b>{formatDate(e.event_date)}</b> · {e.event_type}{e.weight ? ` · ${e.weight} kg` : ""}{e.category_to_id ? ` → ${catName(e.category_to_id)}` : ""}{e.cause ? ` · ${e.cause}` : ""}{e.movement_id ? <span className="ml-1 text-xs font-bold text-brand">(en el stock)</span> : null}
        {e.notes ? <span className="block text-slate-600">{e.notes}</span> : null}{e.responsible ? <span className="block text-xs text-slate-400">{e.responsible}</span> : null}
      </li>)}</ul>}
    </div>
  </Modal>;
}
