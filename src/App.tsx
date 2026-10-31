import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Beef, Building2, ChartColumn, ClipboardCheck, Download, KeyRound, ListOrdered, LoaderCircle, LogOut, Menu, Settings2, Upload, Users, WifiOff } from "lucide-react";
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

type Tab = "stock" | "movimientos" | "conteo" | "indicadores" | "animales" | "equipo" | "config" | "exportar" | "carga" | "establecimientos" | "mas";
type TabDef = { label: string; short?: string; icon: React.ReactNode };
const TABS: Record<Exclude<Tab, "mas">, TabDef> = {
  stock: { label: "Stock", icon: <Beef /> },
  movimientos: { label: "Movimientos", short: "Movim.", icon: <ListOrdered /> },
  conteo: { label: "Conteo mensual", short: "Conteo", icon: <ClipboardCheck /> },
  indicadores: { label: "Indicadores", short: "Indicad.", icon: <ChartColumn /> },
  animales: { label: "Animales", icon: <Beef /> },
  equipo: { label: "Equipo", icon: <Users /> },
  config: { label: "Configuración", icon: <Settings2 /> },
  exportar: { label: "Exportar", icon: <Download /> },
  carga: { label: "Carga masiva", icon: <Upload /> },
  establecimientos: { label: "Establecimientos", icon: <Building2 /> },
};
const MANAGER_TABS: Tab[] = ["stock", "movimientos", "conteo", "indicadores", "animales", "equipo", "config", "exportar", "carga", "establecimientos"];
const VIEWER_TABS: Tab[] = ["stock", "movimientos", "indicadores", "exportar", "establecimientos"];
const MANAGER_MOBILE: Tab[] = ["stock", "movimientos", "indicadores", "conteo", "mas"];
const VIEWER_MOBILE: Tab[] = ["stock", "indicadores", "mas"];

function Shell({ session }: { session: Session }) {
  const userId = session.user.id;
  const fullName = String(session.user.user_metadata?.full_name ?? "").trim();
  const responsable = fullName || session.user.email || "";
  const [ests, setEsts] = useState<Establishment[] | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [estId, setEstId] = useState<string>(() => { try { return localStorage.getItem(EST_KEY) ?? ""; } catch { return ""; } });
  const [tab, setTab] = useState<Tab>("stock");
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
  const go = (next: Tab) => { setTab(next); window.scrollTo({ top: 0 }); };
  const setAsOperator = (on: boolean) => {
    if (!est) return;
    setOperatorView((l) => (on ? [...new Set([...l, est.id])] : l.filter((id) => id !== est.id)));
    go("stock");
    toast.ok(on ? "Ahora ves la app como operario" : "Volviste a la vista completa");
  };

  return <div className="min-h-dvh pb-24 sm:pb-8">
    <header className="sticky top-0 z-30 border-b border-[#dce5e1] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="hidden sm:block"><Brand /></div>
        <img src="./simple-logo.png" alt="SInPLe" className="size-10 rounded-lg object-contain sm:hidden" />
        <div className="min-w-0 flex-1 sm:ml-4">
          {ests.length ? <select aria-label="Establecimiento" value={estId} onChange={(e) => setEstId(e.target.value)} className="h-10 w-full max-w-xs truncate rounded-xl border border-[#cedad5] bg-white px-3 text-sm font-bold text-brand-dark">
            {ests.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select> : <p className="font-black text-brand-dark sm:hidden">SInPLe Stock</p>}
          {role ? <p className="mt-0.5 pl-1 text-xs font-semibold text-slate-500">{asOperator ? "Modo operario" : ROLE_LABEL[role]}</p> : null}
        </div>
        <button onClick={() => void supabase.auth.signOut()} className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" title={`Salir (${session.user.email})`} aria-label="Cerrar sesión"><LogOut className="size-5" /></button>
      </div>
      {asOperator ? <div className="border-t border-amber-200 bg-amber-50"><div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2 text-sm text-amber-900">
        <span className="min-w-0 flex-1 font-semibold">Estás usando la app como operario.</span>
        <button onClick={() => setAsOperator(false)} className="shrink-0 rounded-lg bg-amber-200 px-3 py-1.5 font-bold">Volver a {realRole ? ROLE_LABEL[realRole].toLowerCase() : "gestión"}</button>
      </div></div> : null}
    </header>

    {est && role ? <EstablishmentView key={est.id} est={est} role={role} tab={tab} go={go} userId={userId} responsable={responsable} firstName={fullName.split(/\s+/)[0] ?? ""} ests={ests} roles={roles} reloadEsts={load} setEstId={setEstId} onUseAsOperator={() => setAsOperator(true)} />
      : <main className="mx-auto max-w-5xl px-4 py-5"><EstablishmentsPanel ests={ests} roles={roles} email={session.user.email ?? ""} onChanged={load} onOpen={(id) => { setEstId(id); go("stock"); }} /></main>}
  </div>;
}

function EstablishmentView({ est, role, tab, go, userId, responsable, firstName, ests, roles, reloadEsts, setEstId, onUseAsOperator }: {
  est: Establishment; role: Role; tab: Tab; go: (t: Tab) => void; userId: string; responsable: string; firstName: string;
  ests: Establishment[]; roles: Record<string, Role>; reloadEsts: () => Promise<void>; setEstId: (id: string) => void; onUseAsOperator: () => void;
}) {
  const stock = useStockData(est);
  const manager = canManage(role);
  const allowed = manager ? MANAGER_TABS : VIEWER_TABS;
  const active: Tab = tab === "mas" ? "mas" : allowed.includes(tab) ? tab : "stock";
  const mobile = manager ? MANAGER_MOBILE : VIEWER_MOBILE;
  const more = allowed.filter((t) => !mobile.includes(t));

  const banner = stock.offline || stock.pending.length ? <div className={`mx-auto mt-3 flex max-w-5xl items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${stock.pending.length ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"}`}>
    <WifiOff className="size-4 shrink-0" />{stock.pending.length ? `${stock.pending.length} ${stock.pending.length === 1 ? "movimiento guardado" : "movimientos guardados"} en el celular: se envían solos cuando vuelva la señal.` : "Sin señal: estás viendo la última información guardada."}
  </div> : null;

  if (!stock.data) return <><div className="px-4">{banner}</div><Loading text={stock.loading ? "Cargando stock…" : "No hay datos guardados para ver sin señal."} /></>;
  const data = stock.data;

  if (role === "operator") return <main className="mx-auto max-w-5xl px-4 py-5">{banner}<OperatorHome est={est} data={data} userId={userId} responsable={responsable} firstName={firstName} pending={stock.pending} save={stock.save} reload={stock.reload} loading={stock.loading} /></main>;

  return <>
    <nav className="sticky top-[65px] z-20 hidden border-b border-[#dce5e1] bg-white/95 backdrop-blur sm:block"><div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
      {allowed.map((id) => { const t = TABS[id as Exclude<Tab, "mas">]; return <TabButton key={id} active={active === id} onClick={() => go(id)} icon={t.icon} label={t.label} />; })}
    </div></nav>
    <div className="px-4">{banner}</div>
    <main className="mx-auto max-w-5xl px-4 py-5">
      {active === "mas" ? <div className="space-y-2"><h1 className="mb-3 text-2xl font-black">Más opciones</h1>{more.map((id) => { const t = TABS[id as Exclude<Tab, "mas">]; return <button key={id} onClick={() => go(id)} className="flex w-full items-center gap-3 rounded-2xl border border-[#dce5e1] bg-white p-4 text-left font-black [&_svg]:size-5 [&_svg]:text-brand">{t.icon}{t.label}</button>; })}</div>
        : active === "stock" ? <StockPanel est={est} data={data} role={role} responsable={responsable} save={stock.save} reload={stock.reload} loading={stock.loading} onGoMovements={() => go("movimientos")} />
        : active === "movimientos" ? <MovementsPanel est={est} data={data} role={role} responsable={responsable} save={stock.save} pendingIds={new Set(stock.pending.map((m) => m.id))} />
        : active === "conteo" ? <CountPanel est={est} data={data} responsable={responsable} save={stock.save} />
        : active === "indicadores" ? <IndicatorsPanel est={est} data={data} />
        : active === "animales" ? <AnimalsPanel est={est} data={data} userId={userId} responsable={responsable} save={stock.save} />
        : active === "equipo" ? <TeamPanel est={est} userId={userId} onUseAsOperator={onUseAsOperator} />
        : active === "config" ? <SettingsPanel est={est} data={data} ageRanges={stock.ageRanges} role={role} onSaved={async () => { await reloadEsts(); await stock.reload(); }} />
        : active === "exportar" ? <ExportPanel est={est} data={data} />
        : active === "carga" ? <BulkMovements est={est} data={data} responsable={responsable} save={stock.save} />
        : <EstablishmentsPanel ests={ests} roles={roles} email="" onChanged={reloadEsts} onOpen={(id) => { setEstId(id); go("stock"); }} />}
    </main>
    <nav className={`fixed inset-x-0 bottom-0 z-30 grid border-t border-[#dce5e1] bg-white pb-[env(safe-area-inset-bottom)] sm:hidden ${mobile.length === 5 ? "grid-cols-5" : "grid-cols-3"}`}>
      {mobile.map((id) => id === "mas"
        ? <TabButton key={id} mobile active={active === "mas" || more.includes(active)} onClick={() => go("mas")} icon={<Menu />} label="Más" />
        : <TabButton key={id} mobile active={active === id} onClick={() => go(id)} icon={TABS[id as Exclude<Tab, "mas">].icon} label={TABS[id as Exclude<Tab, "mas">].short ?? TABS[id as Exclude<Tab, "mas">].label} />)}
    </nav>
  </>;
}

function TabButton({ active, onClick, icon, label, mobile }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; mobile?: boolean }) {
  if (mobile) return <button onClick={onClick} className={`flex min-w-0 flex-col items-center gap-1 py-2.5 text-[10px] font-bold tracking-tight [&_svg]:size-5 ${active ? "text-brand" : "text-slate-500"}`}>{icon}<span className="max-w-full truncate">{label}</span></button>;
  return <button onClick={onClick} className={`flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold [&_svg]:size-4 ${active ? "bg-brand-soft text-brand-dark" : "text-slate-600 hover:bg-slate-100"}`}>{icon}{label}</button>;
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
    <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-[0_18px_60px_rgba(15,76,58,.12)] sm:p-9">
      <Brand />
      <h1 className="pt-2 text-2xl font-black">Elegí una nueva contraseña</h1>
      <Field label="Nueva contraseña"><Input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <Button type="submit" className="h-12 w-full" loading={saving}>{!saving ? <KeyRound /> : null}Guardar contraseña</Button>
    </form>
  </main>;
}
