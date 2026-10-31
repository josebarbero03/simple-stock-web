import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, LoaderCircle, LogOut, Menu as MenuIcon, WifiOff } from "lucide-react";
import { AnimalsPanel } from "./components/AnimalsPanel";
import { AuthScreen, Brand } from "./components/AuthScreen";
import { BulkMovements } from "./components/BulkMovements";
import { CountPanel } from "./components/CountPanel";
import { EstablishmentsPanel } from "./components/EstablishmentsPanel";
import { ExportPanel } from "./components/ExportPanel";
import { IndicatorsPanel } from "./components/IndicatorsPanel";
import { MovementsPanel } from "./components/MovementsPanel";
import { OperatorHome } from "./components/OperatorHome";
import { SettingsPanel } from "./components/SettingsPanel";
import { StockPanel } from "./components/StockPanel";
import { TeamPanel } from "./components/TeamPanel";
import { Button, Field, Input, Toaster, toast } from "./components/ui";
import { useStockData } from "./hooks/useStockData";
import { loadEstablishments } from "./lib/api";
import { ROLE_LABEL, canManage } from "./lib/catalog";
import { errorText, supabase } from "./lib/supabase";
import type { Establishment, Role } from "./lib/types";

const EST_KEY = "simple-stock-web-establishment";
// Establecimientos donde quien gestiona eligió usar la app como operario (solo cambia la vista).
const OPERATOR_VIEW_KEY = "simple-stock-web-operator-view";
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; } };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(next);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <>
    <Toaster />
    {loading ? <Loading text="Preparando el acceso…" />
      : recovering && session ? <NewPassword onDone={() => setRecovering(false)} />
      : session ? <Shell session={session} />
      : <AuthScreen />}
  </>;
}

type Tab = "stock" | "movimientos" | "conteo" | "indicadores" | "animales" | "equipo" | "config" | "exportar" | "carga" | "establecimientos";
// Mismos nombres e íconos que el menú lateral de la app original.
const TABS: Record<Tab, { label: string; icon: string }> = {
  stock: { label: "Stock", icon: "🐄" },
  movimientos: { label: "Movimientos", icon: "↔️" },
  conteo: { label: "Conteo físico", icon: "✅" },
  indicadores: { label: "Análisis", icon: "📊" },
  animales: { label: "Animales", icon: "🏷️" },
  carga: { label: "Carga masiva", icon: "＋" },
  exportar: { label: "Reportes", icon: "📄" },
  equipo: { label: "Integrantes", icon: "👥" },
  config: { label: "Configuración", icon: "⚙️" },
  establecimientos: { label: "Establecimientos", icon: "🏠" },
};
const MANAGER_TABS: Tab[] = ["stock", "movimientos", "conteo", "indicadores", "animales", "carga", "exportar", "equipo", "config", "establecimientos"];
const VIEWER_TABS: Tab[] = ["stock", "movimientos", "indicadores", "exportar", "establecimientos"];

function Shell({ session }: { session: Session }) {
  const userId = session.user.id;
  const fullName = String(session.user.user_metadata?.full_name ?? "").trim();
  const responsable = fullName || session.user.email || "";
  const [ests, setEsts] = useState<Establishment[] | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [estId, setEstId] = useState<string>(() => { try { return localStorage.getItem(EST_KEY) ?? ""; } catch { return ""; } });
  const [tab, setTab] = useState<Tab>("stock");
  const [menu, setMenu] = useState(false);
  const [operatorView, setOperatorView] = useState<string[]>(() => read<string[]>(OPERATOR_VIEW_KEY, []));
  useEffect(() => { try { localStorage.setItem(OPERATOR_VIEW_KEY, JSON.stringify(operatorView)); } catch { /* sin almacenamiento */ } }, [operatorView]);

  const load = useCallback(async () => {
    try {
      const r = await loadEstablishments();
      setRoles(r.roles);
      setEsts(r.establishments);
      try { localStorage.setItem("simple-stock-web-ests", JSON.stringify(r)); } catch { /* sin almacenamiento */ }
    } catch (e) {
      const cached = read<{ establishments: Establishment[]; roles: Record<string, Role> } | null>("simple-stock-web-ests", null);
      if (cached) { setRoles(cached.roles); setEsts(cached.establishments); toast.error("Sin conexión: mostrando la última información guardada"); }
      else { toast.error(errorText(e, "No se pudieron cargar los establecimientos")); setEsts([]); }
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (ests && !ests.some((e) => e.id === estId)) setEstId(ests[0]?.id ?? "");
  }, [ests, estId]);
  useEffect(() => { try { if (estId) localStorage.setItem(EST_KEY, estId); } catch { /* sin almacenamiento */ } }, [estId]);

  if (!ests) return <Loading text="Cargando establecimientos…" />;
  const est = ests.find((e) => e.id === estId) ?? null;
  const realRole = est ? roles[est.id] ?? null : null;
  const asOperator = !!est && canManage(realRole) && operatorView.includes(est.id);
  const role: Role | null = asOperator ? "operator" : realRole;
  const allowed = !est || !role ? (["establecimientos"] as Tab[]) : canManage(role) ? MANAGER_TABS : role === "viewer" ? VIEWER_TABS : [];
  const active: Tab = allowed.includes(tab) ? tab : allowed[0] ?? "stock";
  const go = (next: Tab) => { setTab(next); setMenu(false); window.scrollTo({ top: 0 }); };
  const setAsOperator = (on: boolean) => {
    if (!est) return;
    setOperatorView((l) => (on ? [...new Set([...l, est.id])] : l.filter((id) => id !== est.id)));
    go("stock");
    toast.ok(on ? "Ahora ves la app como operario" : "Volviste a la vista completa");
  };

  return <div className="min-h-dvh pb-10">
    <header className="bg-[linear-gradient(135deg,#123b5d_0%,#1f5a7a_60%,#2f7a63_100%)] text-white">
      <div className="mx-auto max-w-5xl px-4 pb-4 pt-4">
        <div className="flex items-center gap-3">
          <img src="./simple-logo.png" alt="SInPLe" className="size-16 shrink-0 rounded-2xl bg-white object-contain p-1" />
          <div className="min-w-0"><p className="text-2xl font-bold leading-tight">SInPLe Stock</p><p className="font-bold leading-tight text-white/90">Seguimiento Integral de la Producción Lechera</p><p className="text-xs text-white/75">Stock animal · movimientos · ventas · muertes · refugos</p></div>
        </div>
        <div className="mt-4 space-y-2 rounded-2xl border border-white/20 bg-white/10 p-3">
          <div className="flex gap-2">
            {allowed.length ? <button onClick={() => setMenu(true)} className="flex h-11 items-center gap-2 rounded-xl bg-white px-4 font-bold text-brand"><MenuIcon className="size-5" />Menú</button> : null}
            <span className="flex h-11 min-w-0 flex-1 items-center gap-2 truncate rounded-xl bg-white/15 px-3 text-sm font-bold">{allowed.length ? <>{TABS[active].icon} {TABS[active].label}</> : "Operario"}</span>
          </div>
          {ests.length ? <select aria-label="Establecimiento" value={estId} onChange={(e) => setEstId(e.target.value)} className="h-11 w-full truncate rounded-xl border-0 bg-white px-3 text-sm font-bold text-brand">
            {ests.map((e) => <option key={e.id} value={e.id}>{e.name}{roles[e.id] ? ` · ${ROLE_LABEL[roles[e.id]]}` : ""}</option>)}
          </select> : null}
          <p className="text-center text-xs text-white/80">{asOperator ? "Modo operario" : role ? ROLE_LABEL[role] : ""}{role ? " · " : ""}{responsable}</p>
        </div>
      </div>
      {asOperator ? <div className="bg-amber-50"><div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2 text-sm text-amber-900">
        <span className="min-w-0 flex-1 font-semibold">Estás usando la app como operario.</span>
        <button onClick={() => setAsOperator(false)} className="shrink-0 rounded-lg bg-amber-200 px-3 py-1.5 font-bold">Volver a {realRole ? ROLE_LABEL[realRole].toLowerCase() : "gestión"}</button>
      </div></div> : null}
    </header>

    {menu ? <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menú">
      <button className="absolute inset-0 bg-black/40" onClick={() => setMenu(false)} aria-label="Cerrar menú" />
      <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto bg-[#eef4f8] p-3 pt-6 shadow-2xl">
        {allowed.map((id) => <button key={id} onClick={() => go(id)} className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] font-bold ${active === id ? "border-[#cad8e3] bg-white text-brand shadow-sm" : "border-transparent text-slate-600"}`}><span className="w-6 text-center text-lg">{TABS[id].icon}</span>{TABS[id].label}</button>)}
        <div className="mt-auto space-y-2 border-t border-[#cad8e3] pt-3">
          <p className="truncate px-2 text-xs text-slate-500">👤 {session.user.email}</p>
          <button onClick={() => void supabase.auth.signOut()} className="flex w-full items-center gap-2 rounded-xl border border-[#cad8e3] bg-white px-4 py-3 text-sm font-bold text-brand"><LogOut className="size-4" />Cerrar sesión</button>
        </div>
      </nav>
    </div> : null}

    {est && role ? <EstablishmentView key={est.id} est={est} role={role} tab={active} go={go} userId={userId} responsable={responsable} firstName={fullName.split(/\s+/)[0] ?? ""} ests={ests} roles={roles} reloadEsts={load} setEstId={setEstId} onUseAsOperator={() => setAsOperator(true)} />
      : <main className="mx-auto max-w-5xl px-4 py-5"><EstablishmentsPanel ests={ests} roles={roles} email={session.user.email ?? ""} onChanged={load} onOpen={(id) => { setEstId(id); go("stock"); }} /></main>}
    <p className="mx-auto max-w-5xl px-4 pt-2 text-center text-xs text-[#667b8d]">SInPLe Stock · web · nube multidispositivo · control físico · análisis</p>
  </div>;
}

function EstablishmentView({ est, role, tab, go, userId, responsable, firstName, ests, roles, reloadEsts, setEstId, onUseAsOperator }: {
  est: Establishment; role: Role; tab: Tab; go: (t: Tab) => void; userId: string; responsable: string; firstName: string;
  ests: Establishment[]; roles: Record<string, Role>; reloadEsts: () => Promise<void>; setEstId: (id: string) => void; onUseAsOperator: () => void;
}) {
  const stock = useStockData(est);
  const active = tab;

  const banner = stock.offline || stock.pending.length ? <div className={`mx-auto mt-3 flex max-w-5xl items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${stock.pending.length ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"}`}>
    <WifiOff className="size-4 shrink-0" />{stock.pending.length ? `${stock.pending.length} ${stock.pending.length === 1 ? "movimiento guardado" : "movimientos guardados"} en el celular: se envían solos cuando vuelva la señal.` : "Sin señal: estás viendo la última información guardada."}
  </div> : null;

  if (!stock.data) return <><div className="px-4">{banner}</div><Loading text={stock.loading ? "Cargando stock…" : "No hay datos guardados para ver sin señal."} /></>;
  const data = stock.data;

  if (role === "operator") return <main className="mx-auto max-w-5xl px-4 py-5">{banner}<OperatorHome est={est} data={data} userId={userId} responsable={responsable} firstName={firstName} pending={stock.pending} save={stock.save} reload={stock.reload} loading={stock.loading} /></main>;

  return <>
    <div className="px-4">{banner}</div>
    <main className="mx-auto max-w-5xl px-4 py-5">
      {active === "stock" ? <StockPanel est={est} data={data} role={role} responsable={responsable} save={stock.save} reload={stock.reload} loading={stock.loading} onGoMovements={() => go("movimientos")} />
        : active === "movimientos" ? <MovementsPanel est={est} data={data} role={role} responsable={responsable} save={stock.save} pendingIds={new Set(stock.pending.map((m) => m.id))} />
        : active === "conteo" ? <CountPanel est={est} data={data} responsable={responsable} save={stock.save} />
        : active === "indicadores" ? <IndicatorsPanel est={est} data={data} ageRanges={stock.ageRanges} />
        : active === "animales" ? <AnimalsPanel est={est} data={data} ageRanges={stock.ageRanges} userId={userId} responsable={responsable} save={stock.save} />
        : active === "equipo" ? <TeamPanel est={est} userId={userId} onUseAsOperator={onUseAsOperator} />
        : active === "config" ? <SettingsPanel est={est} data={data} ageRanges={stock.ageRanges} role={role} onSaved={async () => { await reloadEsts(); await stock.reload(); }} />
        : active === "exportar" ? <ExportPanel est={est} data={data} ageRanges={stock.ageRanges} />
        : active === "carga" ? <BulkMovements est={est} data={data} responsable={responsable} save={stock.save} />
        : <EstablishmentsPanel ests={ests} roles={roles} email="" onChanged={reloadEsts} onOpen={(id) => { setEstId(id); go("stock"); }} />}
    </main>
  </>;
}

function Loading({ text }: { text: string }) {
  return <div className="grid min-h-[60dvh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-10 animate-spin text-brand" /><p className="mt-4 font-semibold text-slate-500">{text}</p></div></div>;
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { toast.error(errorText(error)); return; }
    toast.ok("Contraseña actualizada");
    onDone();
  }
  return <main className="grid min-h-dvh place-items-center p-4">
    <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-[0_18px_60px_rgba(18,59,93,.12)] sm:p-9">
      <Brand />
      <h1 className="pt-2 text-2xl font-black">Elegí una nueva contraseña</h1>
      <Field label="Nueva contraseña"><Input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <Button type="submit" className="h-12 w-full" loading={saving}>{!saving ? <KeyRound /> : null}Guardar contraseña</Button>
    </form>
  </main>;
}
