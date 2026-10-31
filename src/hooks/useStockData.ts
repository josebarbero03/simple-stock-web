import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStockData, upsertMovements } from "../lib/api";
import type { StockData } from "../lib/stock";
import { errorText } from "../lib/supabase";
import type { AgeRange, Category, Establishment, InitialStock, Movement } from "../lib/types";
import { toast } from "../components/ui";

type Snapshot = { categories: Category[]; initial: InitialStock[]; movements: Movement[]; ageRanges: AgeRange[]; savedAt: string };

const cacheKey = (id: string) => `simple-stock-web-cache-${id}`;
const queueKey = (id: string) => `simple-stock-web-queue-${id}`;
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
const isNetworkError = (e: unknown) => !navigator.onLine || /failed to fetch|network|load failed/i.test(String((e as { message?: string })?.message ?? e));

/**
 * Datos de stock de un establecimiento. Guarda una copia para verlos sin señal y una cola de
 * movimientos cargados sin conexión que se envían solos cuando vuelve la señal.
 */
export function useStockData(est: Establishment) {
  const [snap, setSnap] = useState<Snapshot | null>(() => read<Snapshot | null>(cacheKey(est.id), null));
  const [queue, setQueue] = useState<Movement[]>(() => read<Movement[]>(queueKey(est.id), []));
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  const setQueued = useCallback((next: Movement[]) => { setQueue(next); write(queueKey(est.id), next); }, [est.id]);

  const flush = useCallback(async () => {
    const pending = read<Movement[]>(queueKey(est.id), []);
    if (!pending.length || !navigator.onLine) return false;
    try {
      await upsertMovements(pending);
      setQueued([]);
      toast.ok(pending.length === 1 ? "Se envió 1 movimiento que estaba pendiente" : `Se enviaron ${pending.length} movimientos pendientes`);
      return true;
    } catch (e) {
      if (!isNetworkError(e)) toast.error(errorText(e, "No se pudieron enviar los movimientos pendientes"));
      return false;
    }
  }, [est.id, setQueued]);

  const reload = useCallback(async () => {
    setLoading(true);
    await flush();
    try {
      const d = await loadStockData(est.id);
      const next = { ...d, savedAt: new Date().toISOString() };
      setSnap(next);
      write(cacheKey(est.id), next);
      setOffline(false);
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      else toast.error(errorText(e, "No se pudieron cargar los datos del stock"));
    } finally {
      setLoading(false);
    }
  }, [est.id, flush]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const on = () => { setOffline(false); void reload(); };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [reload]);

  /** Guarda movimientos nuevos, editados o borrados (deleted_at). Sin señal quedan en cola. */
  const save = useCallback(async (rows: Movement[]) => {
    const stamped = rows.map((m) => ({ ...m, updated_at: new Date().toISOString() }));
    const applyLocal = (s: Snapshot | null) => {
      if (!s) return s;
      const ids = new Set(stamped.map((m) => m.id));
      const next = { ...s, movements: [...s.movements.filter((m) => !ids.has(m.id)), ...stamped.filter((m) => !m.deleted_at)] };
      write(cacheKey(est.id), next);
      return next;
    };
    try {
      if (!navigator.onLine) throw new Error("Failed to fetch");
      await upsertMovements(stamped);
      setSnap(applyLocal);
      return "sent" as const;
    } catch (e) {
      if (!isNetworkError(e)) { toast.error(errorText(e, "No se pudo guardar")); return "error" as const; }
      const pending = read<Movement[]>(queueKey(est.id), []).filter((m) => !stamped.some((s) => s.id === m.id));
      setQueued([...pending, ...stamped]);
      setSnap(applyLocal);
      setOffline(true);
      return "queued" as const;
    }
  }, [est.id, setQueued]);

  const data: StockData | null = useMemo(() => {
    if (!snap) return null;
    const queuedIds = new Set(queue.map((m) => m.id));
    const movements = [...snap.movements.filter((m) => !queuedIds.has(m.id)), ...queue.filter((m) => !m.deleted_at)];
    return { inventoryDate: est.inventory_date, categories: snap.categories, initial: snap.initial, movements };
  }, [snap, queue, est.inventory_date]);

  return { data, ageRanges: snap?.ageRanges ?? [], loading, offline, pending: queue, savedAt: snap?.savedAt ?? null, reload, save };
}

export type SaveMovements = (rows: Movement[]) => Promise<"sent" | "queued" | "error">;
