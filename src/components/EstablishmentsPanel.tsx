import { useState, type FormEvent } from "react";
import { Building2, ChevronRight, Plus, Trash2 } from "lucide-react";
import { createEstablishment } from "../lib/api";
import { DEFAULT_CATEGORIES, GROUPS, GROUP_LABEL, ROLE_LABEL } from "../lib/catalog";
import { formatDate, today } from "../lib/dates";
import { errorText } from "../lib/supabase";
import type { Establishment, Role } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Select, toast } from "./ui";

export function EstablishmentsPanel({ ests, roles, email, onChanged, onOpen }: { ests: Establishment[]; roles: Record<string, Role>; email: string; onChanged: () => Promise<void>; onOpen: (id: string) => void }) {
  const [creating, setCreating] = useState(false);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-black">Establecimientos</h1><p className="text-sm text-slate-600">Cada establecimiento tiene su propio stock y su equipo.</p></div>
      {ests.length ? <Button onClick={() => setCreating(true)}><Plus />Nuevo establecimiento</Button> : null}
    </div>
    {!ests.length ? <Empty icon={<Building2 />} title="Todavía no tenés establecimientos" text={`Creá el primero con sus categorías y el stock inicial.${email ? ` Si trabajás en el de otra persona, pedile que te sume desde “Equipo” con tu email ${email}.` : ""}`} action={<Button onClick={() => setCreating(true)}><Plus />Crear establecimiento</Button>} />
      : <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{ests.map((e) => <li key={e.id}><button onClick={() => onOpen(e.id)} className="w-full text-left"><Card className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Building2 className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate font-black">{e.name}</span><span className="block truncate text-sm text-slate-500">{e.producer_name || "—"} · inventario {formatDate(e.inventory_date)}</span>{roles[e.id] ? <span className="text-xs font-bold text-brand">{ROLE_LABEL[roles[e.id]]}</span> : null}</span>
        <ChevronRight className="size-5 text-slate-300" />
      </Card></button></li>)}</ul>}
    {creating ? <CreateEstablishment onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await onChanged(); }} /> : null}
  </div>;
}

type Row = { name: string; group: string; h: string; m: string };

function CreateEstablishment({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [producer, setProducer] = useState("");
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Row[]>(DEFAULT_CATEGORIES.map(([n, g]) => ({ name: n, group: g, h: "", m: "" })));
  const [saving, setSaving] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cats = rows.map((r, i) => ({ name: r.name.trim(), technical_group: r.group || null, sort_order: i + 1, h: Math.max(0, Math.round(Number(r.h) || 0)), m: Math.max(0, Math.round(Number(r.m) || 0)) })).filter((r) => r.name);
    if (!name.trim()) { toast.error("Poné el nombre del establecimiento."); return; }
    if (!cats.length) { toast.error("Debe quedar al menos una categoría."); return; }
    if (new Set(cats.map((c) => c.name.toLowerCase())).size !== cats.length) { toast.error("Hay categorías repetidas."); return; }
    setSaving(true);
    try {
      await createEstablishment(name.trim(), producer.trim(), date, cats);
      toast.ok("Establecimiento creado");
      await onCreated();
    } catch (e) { toast.error(errorText(e, "No se pudo crear")); }
    finally { setSaving(false); }
  }

  return <Modal title="Nuevo establecimiento" onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Tambo La Esperanza" autoFocus required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Productor" hint="Opcional"><Input value={producer} onChange={(e) => setProducer(e.target.value)} /></Field>
        <Field label="Fecha del inventario inicial"><Input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      </div>
      <div>
        <p className="text-sm font-black text-slate-700">Categorías y stock inicial</p>
        <p className="text-xs text-slate-500">Cuántos animales hay de cada categoría el día del inventario. Podés cambiarlas después.</p>
        <div className="mt-2 grid grid-cols-[1fr_56px_56px_32px] gap-1.5 text-xs font-bold uppercase text-slate-500"><span>Categoría</span><span>Hembras</span><span>Machos</span><span /></div>
        <div className="space-y-1.5">{rows.map((r, i) => <div key={i} className="grid grid-cols-[1fr_56px_56px_32px] items-center gap-1.5">
          <div><Input value={r.name} onChange={(e) => set(i, { name: e.target.value })} className="!mt-0 !h-10" aria-label={`Categoría ${i + 1}`} />
            <Select value={r.group} onChange={(e) => set(i, { group: e.target.value })} className="!mt-1 !h-8 text-xs" aria-label={`Grupo de ${r.name}`}><option value="">Sin grupo</option>{GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}</Select></div>
          <Input inputMode="numeric" value={r.h} onChange={(e) => set(i, { h: e.target.value.replace(/\D/g, "") })} placeholder="0" className="!mt-0 !h-10 px-2 text-center" aria-label={`Hembras de ${r.name}`} />
          <Input inputMode="numeric" value={r.m} onChange={(e) => set(i, { m: e.target.value.replace(/\D/g, "") })} placeholder="0" className="!mt-0 !h-10 px-2 text-center" aria-label={`Machos de ${r.name}`} />
          <button type="button" onClick={() => setRows((l) => l.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:text-rose-600" aria-label={`Quitar ${r.name}`}><Trash2 className="size-4" /></button>
        </div>)}</div>
        <button type="button" onClick={() => setRows((l) => [...l, { name: "", group: "", h: "", m: "" }])} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand"><Plus className="size-4" />Agregar categoría</button>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" loading={saving}>Crear establecimiento</Button></div>
    </form>
  </Modal>;
}
