import { COW_GROUPS, ENTRY_TYPES, EXIT_TYPES } from "./catalog";
import { addDays, daysBetween, monthStart } from "./dates";
import type { Category, InitialStock, Movement, Sex } from "./types";

export type StockData = { inventoryDate: string; categories: Category[]; initial: InitialStock[]; movements: Movement[] };

const active = (moves: Movement[]) => moves.filter((m) => !m.deleted_at);

/** Cuánto cambia el stock de una categoría por un movimiento. Igual que movementDelta de la app Android. */
export function movementDelta(m: Pick<Movement, "tipo" | "origin_category_id" | "destination_category_id" | "cantidad" | "sexo" | "deleted_at">, catId: string, sex?: Sex) {
  if (m.deleted_at || (sex && m.sexo !== sex)) return 0;
  const n = Number(m.cantidad) || 0;
  if (m.tipo === "Traslado interno") return (m.destination_category_id === catId ? n : 0) - (m.origin_category_id === catId ? n : 0);
  if (ENTRY_TYPES.includes(m.tipo)) return m.destination_category_id === catId ? n : 0;
  if (EXIT_TYPES.includes(m.tipo)) return m.origin_category_id === catId ? -n : 0;
  return 0;
}

export function initialFor(data: StockData, catId: string, sex?: Sex) {
  return data.initial.filter((r) => r.category_id === catId && (!sex || r.sexo === sex)).reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
}

const catList = (data: StockData, catIds?: string[] | null) => (catIds ? data.categories.filter((c) => catIds.includes(c.id)) : data.categories);

/** Stock a una fecha: stock inicial + movimientos desde la fecha de inventario hasta esa fecha (inclusive). */
export function stockAt(data: StockData, date: string, catIds?: string[] | null, sex?: Sex) {
  let total = 0;
  for (const c of catList(data, catIds)) {
    let v = initialFor(data, c.id, sex);
    for (const m of data.movements) if (m.fecha && m.fecha >= data.inventoryDate && m.fecha <= date) v += movementDelta(m, c.id, sex);
    total += v;
  }
  return total;
}

export type StockRow = { category: Category; h: number; m: number; total: number; monthChange: number };
/** Stock por categoría (activas o con animales) y cambio desde el comienzo del mes. */
export function stockTable(data: StockData, date: string): StockRow[] {
  const prev = addDays(monthStart(date), -1);
  return data.categories
    .map((c) => {
      const h = stockAt(data, date, [c.id], "H"), m = stockAt(data, date, [c.id], "M");
      return { category: c, h, m, total: h + m, monthChange: h + m - stockAt(data, prev < data.inventoryDate ? data.inventoryDate : prev, [c.id]) };
    })
    .filter((r) => r.category.active || r.total !== 0)
    .sort((a, b) => a.category.sort_order - b.category.sort_order);
}

/** Stock promedio diario de un período (desde la fecha de inventario como mínimo). */
export function averageStock(data: StockData, start: string, end: string, catIds?: string[] | null) {
  const from = start < data.inventoryDate ? data.inventoryDate : start;
  if (from > end) return { avg: 0, days: 0 };
  const cats = new Set(catList(data, catIds).map((c) => c.id));
  const deltaByDay = new Map<string, number>();
  for (const m of data.movements) {
    if (!m.fecha || m.fecha < from || m.fecha > end) continue;
    let d = 0;
    for (const id of cats) d += movementDelta(m, id);
    if (d) deltaByDay.set(m.fecha, (deltaByDay.get(m.fecha) ?? 0) + d);
  }
  let current = stockAt(data, addDays(from, -1), [...cats]);
  if (from === data.inventoryDate) current = [...cats].reduce((s, id) => s + initialFor(data, id), 0);
  let total = 0, days = 0;
  for (let d = from; d <= end && days < 5000; d = addDays(d, 1)) { current += deltaByDay.get(d) ?? 0; total += current; days++; }
  return { avg: days ? total / days : 0, days };
}

const sumType = (moves: Movement[], tipo: string) => moves.filter((m) => m.tipo === tipo).reduce((s, m) => s + (Number(m.cantidad) || 0), 0);

export function periodMoves(data: StockData, start: string, end: string) {
  const from = start < data.inventoryDate ? data.inventoryDate : start;
  return active(data.movements).filter((m) => m.fecha && m.fecha >= from && m.fecha <= end);
}

/** Entradas, salidas y traslados de un período, opcionalmente para algunas categorías. */
export function periodSummary(data: StockData, start: string, end: string, catIds?: string[] | null) {
  const moves = periodMoves(data, start, end);
  const inSet = (id: string | null) => !catIds || (!!id && catIds.includes(id));
  const ex = moves.filter((m) => inSet(m.origin_category_id));
  const en = moves.filter((m) => inSet(m.destination_category_id));
  const tIn = catIds ? moves.filter((m) => m.tipo === "Traslado interno" && inSet(m.destination_category_id) && !inSet(m.origin_category_id)).reduce((s, m) => s + m.cantidad, 0) : 0;
  const tOut = catIds ? moves.filter((m) => m.tipo === "Traslado interno" && inSet(m.origin_category_id) && !inSet(m.destination_category_id)).reduce((s, m) => s + m.cantidad, 0) : 0;
  const exits = { venta: sumType(ex, "Venta"), muerte: sumType(ex, "Muerte"), descarte: sumType(ex, "Descarte"), egreso: sumType(ex, "Egreso ajuste") };
  const entries = { nacimiento: sumType(en, "Nacimiento"), compra: sumType(en, "Compra"), ingreso: sumType(en, "Ingreso ajuste") };
  const balance = entries.nacimiento + entries.compra + entries.ingreso - exits.venta - exits.muerte - exits.descarte - exits.egreso + tIn - tOut;
  return { moves, exits, entries, transfersIn: tIn, transfersOut: tOut, balance };
}

export type Level = "ok" | "warn" | "bad" | "none";
export function level(value: number | null, good: number, warn: number, kind: "max" | "min"): Level {
  if (value === null || !Number.isFinite(value)) return "none";
  if (kind === "max") return value <= good ? "ok" : value <= warn ? "warn" : "bad";
  return value >= good ? "ok" : value >= warn ? "warn" : "bad";
}

const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : null);
const groupIds = (data: StockData, groups: string[]) => data.categories.filter((c) => groups.includes(c.technical_group ?? "")).map((c) => c.id);

/** Edad al primer parto supuesta para estimar la reposición necesaria (meses). */
export const AGE_FIRST_CALVING = 24;

export function indicators(data: StockData, start: string, end: string, catIds?: string[] | null) {
  const days = Math.max(1, daysBetween(start < data.inventoryDate ? data.inventoryDate : start, end) + 1);
  const avg = averageStock(data, start, end, catIds).avg;
  const s = periodSummary(data, start, end, catIds);
  const refugo = s.exits.venta + s.exits.muerte + s.exits.descarte;
  const annual = (v: number | null) => (v === null ? null : (v * 365) / days);

  // Período anterior de igual largo, para comparar.
  const prevEnd = addDays(start, -1), prevStart = addDays(prevEnd, -(days - 1));
  const prev = periodSummary(data, prevStart, prevEnd, catIds);
  const prevAvg = averageStock(data, prevStart, prevEnd, catIds).avg;

  // Vacas (grupos Ordeñe + Seca) en los últimos 12 meses.
  const cows = groupIds(data, COW_GROUPS);
  const yStart = addDays(end, -364);
  const cowAvg = cows.length ? averageStock(data, yStart, end, cows).avg : 0;
  const cowYear = cows.length ? periodSummary(data, yStart, end, cows) : null;
  const cowRefugoYear = cowYear ? pct(cowYear.exits.venta + cowYear.exits.muerte + cowYear.exits.descarte, cowAvg) : null;
  const cowDeathYear = cowYear ? pct(cowYear.exits.muerte, cowAvg) : null;
  const cowYearDays = Math.max(1, daysBetween(yStart < data.inventoryDate ? data.inventoryDate : yStart, end) + 1);
  const scaleYear = (v: number | null) => (v === null ? null : (v * 365) / cowYearDays);

  const vo = stockAt(data, end, groupIds(data, ["Ordeñe"]));
  const vt = stockAt(data, end, cows);
  const heifers = stockAt(data, end, groupIds(data, ["Reposicion"]));
  const refugoYear = scaleYear(cowRefugoYear);
  const heifersNeeded = refugoYear === null ? null : (refugoYear * (AGE_FIRST_CALVING / 12)) / 0.9;

  const byGroup = new Map<string, number>();
  for (const c of data.categories) byGroup.set(c.technical_group ?? "", (byGroup.get(c.technical_group ?? "") ?? 0) + stockAt(data, end, [c.id]));
  const causes = (tipo: string) => {
    const m = new Map<string, number>();
    for (const x of s.moves.filter((x) => x.tipo === tipo && (!catIds || (x.origin_category_id && catIds.includes(x.origin_category_id))))) {
      const k = x.causa?.trim() || "Sin causa registrada";
      m.set(k, (m.get(k) ?? 0) + x.cantidad);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return {
    days,
    stock: stockAt(data, end, catIds), stockH: stockAt(data, end, catIds, "H"), stockM: stockAt(data, end, catIds, "M"),
    avg, summary: s, refugo,
    refugoPct: pct(refugo, avg), refugoAnnual: annual(pct(refugo, avg)),
    salePct: pct(s.exits.venta, avg), deathPct: pct(s.exits.muerte, avg),
    prevRefugoPct: pct(prev.exits.venta + prev.exits.muerte + prev.exits.descarte, prevAvg),
    cows: { has: cows.length > 0, vo, vt, voVt: pct(vo, vt), refugoYear, deathYear: scaleYear(cowDeathYear), heifers, heifersPer100: pct(heifers, vt), heifersNeeded },
    composition: [...byGroup.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]),
    saleCauses: causes("Venta"), deathCauses: causes("Muerte"),
  };
}

/** Altas, bajas y stock a fin de mes para los últimos meses. */
export function monthlyTrend(data: StockData, end: string, months = 12, catIds?: string[] | null) {
  const out: { month: string; entries: number; exits: number; stock: number }[] = [];
  let m = monthStart(end);
  for (let i = 0; i < months - 1; i++) m = monthStart(addDays(m, -1));
  for (let i = 0; i < months; i++) {
    const next = monthStart(addDays(m, 32));
    const last = addDays(next, -1) > end ? end : addDays(next, -1);
    if (last >= data.inventoryDate) {
      const s = periodSummary(data, m, last, catIds);
      out.push({ month: m.slice(0, 7), entries: s.entries.nacimiento + s.entries.compra, exits: s.exits.venta + s.exits.muerte + s.exits.descarte, stock: stockAt(data, last, catIds) });
    }
    m = next;
  }
  return out;
}
