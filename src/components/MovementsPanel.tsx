import { useMemo, useState, type FormEvent } from "react";
import { CloudOff, ListOrdered, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { SaveMovements } from "../hooks/useStockData";
import { MOVEMENT_TYPES, TYPE_PLAIN, canManage, canOperate, causesFor, needsDestination, needsOrigin } from "../lib/catalog";
import { addDays, formatDate, today } from "../lib/dates";
import { buildMovement, describeMovement, draftFrom, validateDraft, type MovementDraft } from "../lib/movements";
import type { StockData } from "../lib/stock";
import type { Establishment, Movement, MovementType, Role, Sex } from "../lib/types";
import { MovementWizard, TYPE_STYLE } from "./MovementWizard";
import { Button, Card, Empty, Field, Input, Modal, Select, Textarea, toast } from "./ui";

const PERIODS = [{ id: "30", label: "30 días" }, { id: "mes", label: "Este mes" }, { id: "anio", label: "Este año" }, { id: "todo", label: "Todo" }] as const;

export function MovementsPanel({ est, data, role, responsable, save, pendingIds }: { est: Establishment; data: StockData; role: Role; responsable: string; save: SaveMovements; pendingIds: Set<string> }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("30");
  const [type, setType] = useState<MovementType | "">("");
  const [catId, setCatId] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Movement | null>(null);
  const [wizard, setWizard] = useState(false);
  const day = today();
  const from = period === "30" ? addDays(day, -29) : period === "mes" ? day.slice(0, 8) + "01" : period === "anio" ? day.slice(0, 5) + "01-01" : "0000-01-01";

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.movements
      .filter((m) => m.fecha >= from && (!type || m.tipo === type) && (!catId || m.origin_category_id === catId || m.destination_category_id === catId)
        && (!q || [m.rp, m.causa, m.responsable, m.observacion, m.origen, m.destino].some((v) => v?.toLowerCase().includes(q))))
      .sort((a, b) => (b.fecha + (b.hora ?? "")).localeCompare(a.fecha + (a.hora ?? "")));
  }, [data.movements, from, type, catId, query]);
  const byDay = useMemo(() => { const m = new Map<string, Movement[]>(); for (const x of list) m.set(x.fecha, [...(m.get(x.fecha) ?? []), x]); return [...m.entries()]; }, [list]);
  const ins = list.filter((m) => ["Nacimiento", "Compra", "Ingreso ajuste"].includes(m.tipo)).reduce((s, m) => s + m.cantidad, 0);
  const outs = list.filter((m) => ["Venta", "Muerte", "Descarte", "Egreso ajuste"].includes(m.tipo)).reduce((s, m) => s + m.cantidad, 0);
  const before = est.inventory_date;

  async function remove(m: Movement) {
    if (!window.confirm(`¿Borrar este movimiento?\n${TYPE_PLAIN[m.tipo]} · ${describeMovement(m)} · ${formatDate(m.fecha)}`)) return;
    const r = await save([{ ...m, deleted_at: new Date().toISOString() }]);
    if (r !== "error") toast.ok(r === "queued" ? "Borrado sin señal: se envía cuando vuelva" : "Movimiento borrado");
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-black">Movimientos</h1><p className="text-sm text-slate-600">{est.name}</p></div>
      {canOperate(role) ? <Button onClick={() => setWizard(true)}><Plus />Nuevo movimiento</Button> : null}
    </div>
    <Card className="space-y-3 !p-3 sm:!p-4">
      <div className="flex flex-wrap gap-1.5">{PERIODS.map((p) => <button key={p.id} onClick={() => setPeriod(p.id)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${period === p.id ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{p.label}</button>)}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={type} onChange={(e) => setType(e.target.value as MovementType | "")} className="!mt-0" aria-label="Tipo"><option value="">Todos los tipos</option>{MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_PLAIN[t]}</option>)}</Select>
        <Select value={catId} onChange={(e) => setCatId(e.target.value)} className="!mt-0" aria-label="Categoría"><option value="">Todas las categorías</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caravana, causa, responsable" className="!mt-0 pl-9" aria-label="Buscar" /></div>
      </div>
      <p className="text-sm text-slate-600"><strong>{list.length}</strong> movimientos · <span className="font-bold text-emerald-700">+{ins} entradas</span> · <span className="font-bold text-rose-700">−{outs} salidas</span></p>
    </Card>

    {!list.length ? <Empty icon={<ListOrdered />} title="Sin movimientos" text="No hay movimientos con estos filtros." />
      : byDay.map(([d, items]) => <section key={d}>
        <h2 className="mb-1 text-sm font-black uppercase tracking-wide text-slate-500">{d === day ? "Hoy" : d === addDays(day, -1) ? "Ayer" : formatDate(d)}{d < before ? " · antes del inventario (no cuenta)" : ""}</h2>
        <ul className="divide-y divide-[#edf2f0] rounded-2xl border border-[#dce5e1] bg-white">{items.map((m) => <li key={m.id} className="flex items-center gap-3 p-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5 ${TYPE_STYLE[m.tipo].color}`}>{TYPE_STYLE[m.tipo].icon}</span>
          <div className="min-w-0 flex-1">
            <p className="font-black">{TYPE_PLAIN[m.tipo]} <span className="font-semibold text-slate-600">· {describeMovement(m)}</span></p>
            <p className="truncate text-sm text-slate-500">{[m.causa, m.rp ? `Caravana/lote ${m.rp}` : "", m.responsable, m.hora].filter(Boolean).join(" · ")}</p>
            {m.observacion ? <p className="truncate text-sm text-slate-600">{m.observacion}</p> : null}
          </div>
          {pendingIds.has(m.id) ? <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900" title="Guardado en el celular, se envía cuando haya señal"><CloudOff className="size-3.5" />Pendiente</span> : null}
          {canManage(role) ? <div className="flex shrink-0">
            <button onClick={() => setEditing(m)} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Editar"><Pencil className="size-4" /></button>
            <button onClick={() => void remove(m)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Borrar"><Trash2 className="size-4" /></button>
          </div> : null}
        </li>)}</ul>
      </section>)}

    {editing ? <MovementForm est={est} data={data} movement={editing} responsable={responsable} save={save} onClose={() => setEditing(null)} /> : null}
    {wizard ? <MovementWizard establishmentId={est.id} data={data} responsable={responsable} allowAdjustments={canManage(role)} onSave={save} onClose={() => setWizard(false)} /> : null}
  </div>;
}

function MovementForm({ est, data, movement, responsable, save, onClose }: { est: Establishment; data: StockData; movement: Movement; responsable: string; save: SaveMovements; onClose: () => void }) {
  const [d, setD] = useState<MovementDraft>(draftFrom(movement));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<MovementDraft>) => setD((x) => ({ ...x, ...patch }));
  const cats = data.categories.filter((c) => c.active || c.id === d.origin || c.id === d.destination);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validateDraft(d, undefined, data.inventoryDate);
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    const r = await save([buildMovement(d, est.id, data.categories, responsable, movement)]);
    setSaving(false);
    if (r === "error") return;
    toast.ok("Movimiento actualizado");
    onClose();
  }

  return <Modal title="Editar movimiento" onClose={onClose}>
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><Select value={d.tipo} onChange={(e) => set({ tipo: e.target.value as MovementType })}>{MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_PLAIN[t]}</option>)}</Select></Field>
        <Field label="Fecha"><Input type="date" min={data.inventoryDate} max={today()} value={d.fecha} onChange={(e) => set({ fecha: e.target.value })} /></Field>
        {needsOrigin(d.tipo) ? <Field label={d.tipo === "Traslado interno" ? "De (origen)" : "Categoría"}><Select value={d.origin ?? ""} onChange={(e) => set({ origin: e.target.value || null })}><option value="">Elegí…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field> : null}
        {needsDestination(d.tipo) ? <Field label={d.tipo === "Traslado interno" ? "A (destino)" : "Categoría"}><Select value={d.destination ?? ""} onChange={(e) => set({ destination: e.target.value || null })}><option value="">Elegí…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field> : null}
        <Field label="Sexo"><Select value={d.sexo} onChange={(e) => set({ sexo: e.target.value as Sex })}><option value="H">Hembras</option><option value="M">Machos</option></Select></Field>
        <Field label="Cantidad"><Input type="number" min={1} step={1} value={d.cantidad} onChange={(e) => set({ cantidad: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Causa"><Input list="mov-causes" value={d.causa} onChange={(e) => set({ causa: e.target.value })} /></Field>
      <datalist id="mov-causes">{causesFor(d.tipo).map((c) => <option key={c} value={c} />)}</datalist>
      <Field label="Caravana, RP o lote"><Input value={d.rp} onChange={(e) => set({ rp: e.target.value })} /></Field>
      <Field label="Observación"><Textarea value={d.observacion} onChange={(e) => set({ observacion: e.target.value })} rows={2} /></Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" loading={saving}>Guardar</Button></div>
    </form>
  </Modal>;
}
