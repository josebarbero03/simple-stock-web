import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HardHat, Trash2, UserPlus } from "lucide-react";
import { addMember, listMembers, removeMember } from "../lib/api";
import { INVITABLE_ROLES, ROLE_LABEL } from "../lib/catalog";
import { errorText } from "../lib/supabase";
import type { Establishment, Member, Role } from "../lib/types";
import { Button, Card, Field, Input, Select, toast } from "./ui";

const ROLE_HELP: Record<Exclude<Role, "owner">, string> = {
  operator: "Registra movimientos con pantallas simples (nacimientos, muertes, ventas, cambios de categoría).",
  manager: "Todo: movimientos, conteo, indicadores, configuración y equipo.",
  viewer: "Solo mira el stock, los movimientos y los indicadores.",
};

export function TeamPanel({ est, userId, onUseAsOperator }: { est: Establishment; userId: string; onUseAsOperator: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("operator");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { setMembers(await listMembers(est.id)); } catch (e) { toast.error(errorText(e, "No se pudo cargar el equipo")); setMembers([]); }
  }, [est.id]);
  useEffect(() => { void load(); }, [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const me = members?.find((m) => m.user_id === userId);
    if (me?.email && me.email.toLowerCase() === email.trim().toLowerCase()) { toast.error("Ese es tu propio email. Para registrar como operario usá “Usar como operario”."); return; }
    setSaving(true);
    try { await addMember(est.id, email.trim(), role); toast.ok(`${email.trim()} se sumó como ${ROLE_LABEL[role].toLowerCase()}`); setEmail(""); await load(); }
    catch (e) { toast.error(errorText(e, "No se pudo agregar. La persona tiene que haber creado su cuenta en SInPLe con ese email.")); }
    finally { setSaving(false); }
  }
  async function changeRole(m: Member, next: Exclude<Role, "owner">) {
    if (!m.email) { toast.error("No se puede cambiar el rol de esta persona."); return; }
    try { await addMember(est.id, m.email, next); toast.ok("Rol actualizado"); await load(); } catch (e) { toast.error(errorText(e, "No se pudo cambiar el rol")); }
  }
  async function remove(m: Member) {
    if (!window.confirm(`¿Quitar el acceso de ${m.display_name || m.email}?`)) return;
    try { await removeMember(est.id, m.user_id); await load(); } catch (e) { toast.error(errorText(e, "No se pudo quitar")); }
  }

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-black">Equipo</h1><p className="text-sm text-slate-600">Quiénes trabajan en {est.name} y qué pueden hacer</p></div>
    <Card>
      <form onSubmit={add} className="space-y-3">
        <p className="flex items-center gap-2 font-black"><UserPlus className="size-5 text-brand" />Sumar persona</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" required /></Field>
          <Field label="Rol"><Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>{INVITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
        </div>
        <p className="text-sm text-slate-500">{ROLE_HELP[role]} La persona primero tiene que crear su cuenta en la app con ese email.</p>
        <Button type="submit" loading={saving} className="w-full sm:w-auto">Agregar</Button>
      </form>
    </Card>
    {members === null ? <p className="text-center text-slate-500">Cargando…</p> : <ul className="space-y-2">{members.map((m) => <li key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#dce5e1] bg-white p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-black text-brand-dark">{(m.display_name || m.email || "?").charAt(0).toUpperCase()}</span>
      <div className="min-w-0 flex-1"><p className="truncate font-black">{m.display_name || m.email}{m.user_id === userId ? <span className="font-semibold text-slate-400"> (vos)</span> : null}</p><p className="truncate text-sm text-slate-500">{m.email}</p></div>
      {m.role === "owner" || m.user_id === userId ? <span className="rounded-full bg-brand-deep px-3 py-1 text-xs font-bold text-white">{ROLE_LABEL[m.role]}</span> : <>
        <button onClick={() => void remove(m)} className="grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 sm:order-last" aria-label={`Quitar a ${m.email}`}><Trash2 className="size-4" /></button>
        <Select value={m.role} onChange={(e) => void changeRole(m, e.target.value as Exclude<Role, "owner">)} className="!mt-0 !h-10 sm:w-44" aria-label={`Rol de ${m.email}`}>{INVITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
      </>}
      {m.user_id === userId ? <div className="w-full space-y-2 rounded-xl bg-slate-50 px-3 py-3 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
        <p className="text-sm text-slate-600 sm:flex-1">¿Vas a cargar en el campo? Usá la app como operario (pantalla simple) y volvés cuando quieras.</p>
        <Button variant="secondary" onClick={onUseAsOperator} className="w-full sm:w-auto"><HardHat />Usar como operario</Button>
      </div> : null}
    </li>)}</ul>}
  </div>;
}
