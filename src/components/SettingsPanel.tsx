import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { addCategory, replaceAgeRanges, setInitialStock, updateCategory, updateEstablishment } from "../lib/api";
import { GROUPS, GROUP_LABEL } from "../lib/catalog";
import { formatDate, today } from "../lib/dates";
import { initialFor, type StockData } from "../lib/stock";
import { errorText } from "../lib/supabase";
import type { AgeRange, Category, Establishment, Role } from "../lib/types";
import { Button, Card, Field, Input, Select, toast } from "./ui";

export function SettingsPanel({ est, data, ageRanges, role, onSaved }: { est: Establishment; data: StockData; ageRanges: AgeRange[]; role: Role; onSaved: () => Promise<void> }) {
  return <div className="space-y-4">
    <div><h1 className="text-2xl font-black">Configuración</h1><p className="text-sm text-slate-600">{est.name}</p></div>
    <EstablishmentForm est={est} onSaved={onSaved} />
    <CategoriesForm est={est} data={data} onSaved={onSaved} />
    <InitialStockForm est={est} data={data} onSaved={onSaved} />
    {role === "owner" ? <AgeRangesForm est={est} ranges={ageRanges} onSaved={onSaved} /> : null}
  </div>;
}

function EstablishmentForm({ est, onSaved }: { est: Establishment; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(est.name);
  const [producer, setProducer] = useState(est.producer_name ?? "");
  const [date, setDate] = useState(est.inventory_date);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (date !== est.inventory_date && !window.confirm(`Vas a cambiar la fecha del inventario inicial a ${formatDate(date)}. Los movimientos anteriores a esa fecha dejan de contar para el stock. ¿Seguir?`)) return;
    setSaving(true);
    try { await updateEstablishment(est.id, { name: name.trim(), producer_name: producer.trim() || null, inventory_date: date }); toast.ok("Datos guardados"); await onSaved(); }
    catch (e) { toast.error(errorText(e, "No se pudo guardar")); } finally { setSaving(false); }
  }
  return <Card><form onSubmit={submit} className="space-y-3">
    <p className="font-black">Datos del establecimiento</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="Productor"><Input value={producer} onChange={(e) => setProducer(e.target.value)} /></Field>
      <Field label="Fecha del inventario inicial" hint="El stock se calcula desde esta fecha"><Input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
    </div>
    <div className="flex justify-end"><Button type="submit" loading={saving}>Guardar</Button></div>
  </form></Card>;
}

function CategoriesForm({ est, data, onSaved }: { est: Establishment; data: StockData; onSaved: () => Promise<void> }) {
  const sorted = [...data.categories].sort((a, b) => a.sort_order - b.sort_order);
  const [rows, setRows] = useState<Category[]>(sorted);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (id: string, patch: Partial<Category>) => setRows((r) => r.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const move = (i: number, dir: -1 | 1) => setRows((r) => { const n = [...r]; const j = i + dir; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function save() {
    const names = rows.map((r) => r.name.trim().toLowerCase());
    if (names.some((n) => !n)) { toast.error("Ninguna categoría puede quedar sin nombre."); return; }
    if (new Set(names).size !== names.length) { toast.error("Hay categorías repetidas."); return; }
    setSaving(true);
    try {
      for (const [i, r] of rows.entries()) {
        const old = sorted.find((c) => c.id === r.id)!;
        if (old.name !== r.name.trim() || (old.technical_group ?? "") !== (r.technical_group ?? "") || old.active !== r.active || old.sort_order !== i + 1)
          await updateCategory(r.id, { name: r.name.trim(), technical_group: r.technical_group || null, sort_order: i + 1, active: r.active });
      }
      toast.ok("Categorías guardadas");
      await onSaved();
    } catch (e) { toast.error(errorText(e, "No se pudieron guardar")); } finally { setSaving(false); }
  }
  async function add() {
    if (!newName.trim()) return;
    if (rows.some((r) => r.name.trim().toLowerCase() === newName.trim().toLowerCase())) { toast.error("Ya existe esa categoría."); return; }
    setSaving(true);
    try { await addCategory(est.id, newName.trim(), newGroup || null, rows.length + 1); toast.ok("Categoría agregada"); setNewName(""); await onSaved(); }
    catch (e) { toast.error(errorText(e, "No se pudo agregar")); } finally { setSaving(false); }
  }

  return <Card className="space-y-3">
    <div><p className="font-black">Categorías</p><p className="text-sm text-slate-500">El grupo se usa para los indicadores (vacas en ordeñe, secas, reposición). Una categoría inactiva no aparece para cargar movimientos, pero conserva su historia.</p></div>
    <ul className="space-y-2">{rows.map((c, i) => <li key={c.id} className={`grid grid-cols-[auto_1fr] gap-2 rounded-xl border border-[#edf2f0] p-2 sm:grid-cols-[auto_1fr_200px_auto] sm:items-center ${c.active ? "" : "opacity-60"}`}>
      <div className="flex flex-col"><button onClick={() => move(i, -1)} className="grid size-7 place-items-center text-slate-400" aria-label={`Subir ${c.name}`}><ArrowUp className="size-4" /></button><button onClick={() => move(i, 1)} className="grid size-7 place-items-center text-slate-400" aria-label={`Bajar ${c.name}`}><ArrowDown className="size-4" /></button></div>
      <Input value={c.name} onChange={(e) => set(c.id, { name: e.target.value })} className="!mt-0" aria-label={`Nombre de ${c.name}`} />
      <Select value={c.technical_group ?? ""} onChange={(e) => set(c.id, { technical_group: e.target.value || null })} className="col-span-2 !mt-0 sm:col-span-1" aria-label={`Grupo de ${c.name}`}><option value="">Sin grupo</option>{GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}</Select>
      <label className="col-span-2 flex items-center gap-2 text-sm font-semibold sm:col-span-1"><input type="checkbox" checked={c.active} onChange={(e) => set(c.id, { active: e.target.checked })} className="size-4 accent-[#0f6b50]" />Activa</label>
    </li>)}</ul>
    <div className="flex justify-end"><Button onClick={() => void save()} loading={saving}>Guardar categorías</Button></div>
    <div className="grid grid-cols-1 gap-2 border-t border-[#edf2f0] pt-3 sm:grid-cols-[1fr_200px_auto]">
      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva categoría" className="!mt-0" aria-label="Nueva categoría" />
      <Select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className="!mt-0" aria-label="Grupo de la nueva categoría"><option value="">Sin grupo</option>{GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}</Select>
      <Button variant="secondary" onClick={() => void add()} disabled={!newName.trim() || saving}><Plus />Agregar</Button>
    </div>
  </Card>;
}

function InitialStockForm({ est, data, onSaved }: { est: Establishment; data: StockData; onSaved: () => Promise<void> }) {
  const cats = [...data.categories].sort((a, b) => a.sort_order - b.sort_order);
  const [vals, setVals] = useState<Record<string, { H: string; M: string }>>(Object.fromEntries(cats.map((c) => [c.id, { H: String(initialFor(data, c.id, "H")), M: String(initialFor(data, c.id, "M")) }])));
  const [saving, setSaving] = useState(false);
  async function save() {
    const changed = cats.filter((c) => Number(vals[c.id]?.H || 0) !== initialFor(data, c.id, "H") || Number(vals[c.id]?.M || 0) !== initialFor(data, c.id, "M"));
    if (!changed.length) { toast.error("No hay cambios."); return; }
    if (!window.confirm(`Vas a cambiar el stock inicial de ${changed.length} ${changed.length === 1 ? "categoría" : "categorías"} al ${formatDate(est.inventory_date)}. Esto cambia el stock actual. ¿Seguir?`)) return;
    setSaving(true);
    try { for (const c of changed) await setInitialStock(est.id, c.id, Number(vals[c.id].H || 0), Number(vals[c.id].M || 0), est.inventory_date); toast.ok("Stock inicial guardado"); await onSaved(); }
    catch (e) { toast.error(errorText(e, "No se pudo guardar")); } finally { setSaving(false); }
  }
  return <Card className="space-y-3">
    <div><p className="font-black">Stock inicial al {formatDate(est.inventory_date)}</p><p className="text-sm text-slate-500">Cuántos animales había el día del inventario. Para corregir diferencias del día a día usá el Conteo mensual.</p></div>
    <div className="grid grid-cols-[1fr_72px_72px] gap-2 text-xs font-bold uppercase text-slate-500"><span>Categoría</span><span>Hembras</span><span>Machos</span></div>
    {cats.map((c) => <div key={c.id} className="grid grid-cols-[1fr_72px_72px] items-center gap-2">
      <span className="truncate font-semibold">{c.name}</span>
      {(["H", "M"] as const).map((s) => <Input key={s} inputMode="numeric" value={vals[c.id]?.[s] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [c.id]: { ...v[c.id], [s]: e.target.value.replace(/\D/g, "") } }))} className="!mt-0 !h-10 px-2 text-center" aria-label={`Stock inicial ${c.name} ${s}`} />)}
    </div>)}
    <div className="flex justify-end"><Button onClick={() => void save()} loading={saving}>Guardar stock inicial</Button></div>
  </Card>;
}

function AgeRangesForm({ est, ranges, onSaved }: { est: Establishment; ranges: AgeRange[]; onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState<AgeRange[]>(ranges.length ? ranges : [{ label: "0–60 días", min_days: 0, max_days: 60, sort_order: 1, active: true }]);
  const [saving, setSaving] = useState(false);
  const set = (i: number, patch: Partial<AgeRange>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  async function save() {
    if (rows.some((r) => !r.label.trim() || r.min_days < 0 || (r.max_days !== null && r.max_days < r.min_days))) { toast.error("Revisá los rangos: cada uno necesita nombre y un 'hasta' mayor o igual al 'desde'."); return; }
    setSaving(true);
    try { await replaceAgeRanges(est.id, rows); toast.ok("Rangos guardados"); await onSaved(); } catch (e) { toast.error(errorText(e, "No se pudieron guardar")); } finally { setSaving(false); }
  }
  return <Card className="space-y-3">
    <div><p className="font-black">Rangos de edad (animales individuales)</p><p className="text-sm text-slate-500">Se usan para agrupar las fichas individuales por edad. Solo el propietario los cambia.</p></div>
    {rows.map((r, i) => <div key={i} className="grid grid-cols-[1fr_70px_70px] items-center gap-2">
      <Input value={r.label} onChange={(e) => set(i, { label: e.target.value })} className="!mt-0" aria-label={`Nombre del rango ${i + 1}`} />
      <Input inputMode="numeric" value={r.min_days} onChange={(e) => set(i, { min_days: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="!mt-0 px-2 text-center" aria-label="Desde día" />
      <Input inputMode="numeric" value={r.max_days ?? ""} placeholder="sin tope" onChange={(e) => set(i, { max_days: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} className="!mt-0 px-2 text-center" aria-label="Hasta día" />
    </div>)}
    <div className="flex justify-between"><button onClick={() => setRows((r) => [...r, { label: "", min_days: (r.at(-1)?.max_days ?? 0) + 1, max_days: null, sort_order: r.length + 1, active: true }])} className="inline-flex items-center gap-1 text-sm font-bold text-brand"><Plus className="size-4" />Agregar rango</button><Button onClick={() => void save()} loading={saving}>Guardar rangos</Button></div>
  </Card>;
}
