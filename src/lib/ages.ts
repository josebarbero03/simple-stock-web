import { daysBetween } from "./dates";
import type { AgeRange, Animal } from "./types";

/** Mismos rangos por defecto que la app Android cuando el propietario no definió los suyos. */
export const DEFAULT_AGE_RANGES: AgeRange[] = [
  { label: "0–60 días", min_days: 0, max_days: 60, sort_order: 1, active: true },
  { label: "61–119 días", min_days: 61, max_days: 119, sort_order: 2, active: true },
  { label: "120–180 días", min_days: 120, max_days: 180, sort_order: 3, active: true },
  { label: "181–365 días", min_days: 181, max_days: 365, sort_order: 4, active: true },
  { label: "Más de 365 días", min_days: 366, max_days: null, sort_order: 5, active: true },
];

export function activeRanges(ranges: AgeRange[]) {
  const src = ranges.length ? ranges : DEFAULT_AGE_RANGES;
  return src.filter((r) => r.active !== false).sort((a, b) => a.sort_order - b.sort_order || a.min_days - b.min_days);
}

export const ageDays = (a: Animal, on: string) => (a.birth_date ? Math.max(0, daysBetween(a.birth_date, on)) : null);
export const inRange = (d: number | null, r: Pick<AgeRange, "min_days" | "max_days">) => d !== null && d >= r.min_days && (r.max_days === null || d <= r.max_days);

export type AgeBucket = { range: AgeRange; total: number; h: number; m: number; byCategory: { id: string | null; count: number }[] };

/** Cuenta los animales activos (con ficha) de cada rango de días de nacido, como la app original. */
export function ageBuckets(animals: Animal[], ranges: AgeRange[], on: string) {
  const active = animals.filter((a) => a.status === "active" && !a.deleted_at);
  const buckets: AgeBucket[] = activeRanges(ranges).map((range) => {
    const list = active.filter((a) => inRange(ageDays(a, on), range));
    const cats = new Map<string | null, number>();
    for (const a of list) cats.set(a.current_category_id, (cats.get(a.current_category_id) ?? 0) + 1);
    return { range, total: list.length, h: list.filter((a) => a.sexo === "H").length, m: list.filter((a) => a.sexo === "M").length, byCategory: [...cats.entries()].map(([id, count]) => ({ id, count })).sort((x, y) => y.count - x.count) };
  });
  const counted = buckets.reduce((s, b) => s + b.total, 0);
  return { buckets, active: active.length, withoutDate: active.filter((a) => !a.birth_date).length, outside: active.length - counted };
}
