import { describe, expect, it } from "vitest";
import { averageStock, indicators, level, monthlyTrend, movementDelta, periodSummary, stockAt, stockTable, type StockData } from "../src/lib/stock";
import type { Category, InitialStock, Movement } from "../src/lib/types";

const cat = (id: string, name: string, group: string, order: number): Category => ({ id, establishment_id: "e", name, technical_group: group, sort_order: order, active: true, updated_at: "" });
const ini = (category_id: string, sexo: "H" | "M", cantidad: number): InitialStock => ({ id: category_id + sexo, establishment_id: "e", category_id, sexo, cantidad, inventory_date: "2026-01-01", updated_at: "" });
let n = 0;
const mov = (tipo: Movement["tipo"], fecha: string, cantidad: number, o: string | null, d: string | null, sexo: "H" | "M" = "H", extra: Partial<Movement> = {}): Movement => ({
  id: "m" + n++, establishment_id: "e", origin_category_id: o, destination_category_id: d, fecha, hora: null, tipo, origen: null, destino: null, sexo, cantidad,
  rp: null, causa: null, responsable: null, observacion: null, updated_at: "", deleted_at: null, ...extra,
});

const data: StockData = {
  inventoryDate: "2026-01-01",
  categories: [cat("vo", "Vacas Ordeñe", "Ordeñe", 1), cat("vs", "Vacas Secas", "Seca", 2), cat("vq", "Vaquillona Preñada", "Reposicion", 3), cat("gu", "Guachera", "Guachera", 4)],
  initial: [ini("vo", "H", 80), ini("vs", "H", 20), ini("vq", "H", 40), ini("gu", "H", 10), ini("gu", "M", 5)],
  movements: [
    mov("Venta", "2025-12-31", 99, "vo", null), // antes del inventario: no cuenta
    mov("Nacimiento", "2026-01-10", 3, null, "gu", "H"),
    mov("Nacimiento", "2026-01-10", 2, null, "gu", "M"),
    mov("Traslado interno", "2026-02-01", 5, "vs", "vo"),
    mov("Venta", "2026-02-15", 4, "vo", null, "H", { causa: "Mastitis / problema de ubre" }),
    mov("Muerte", "2026-03-01", 1, "vo", null, "H", { causa: "Problema de parto / distocia / periparto" }),
    mov("Descarte", "2026-03-05", 1, "vs", null),
    mov("Venta", "2026-03-06", 10, "vo", null, "H", { deleted_at: "2026-03-07" }), // borrado
  ],
};

describe("cálculo del stock (igual que la app Android)", () => {
  it("movementDelta por tipo", () => {
    const t = data.movements[3];
    expect(movementDelta(t, "vo")).toBe(5);
    expect(movementDelta(t, "vs")).toBe(-5);
    expect(movementDelta(data.movements[4], "vo")).toBe(-4);
    expect(movementDelta(data.movements[1], "gu", "M")).toBe(0);
    expect(movementDelta(data.movements[7], "vo")).toBe(0);
  });
  it("stock a una fecha ignora movimientos previos al inventario y borrados", () => {
    expect(stockAt(data, "2026-01-01")).toBe(155);
    expect(stockAt(data, "2026-03-31")).toBe(155 + 5 - 4 - 1 - 1);
    expect(stockAt(data, "2026-03-31", ["vo"])).toBe(80 + 5 - 4 - 1);
    expect(stockAt(data, "2026-03-31", ["gu"], "M")).toBe(7);
  });
  it("tabla por categoría con cambio en el mes", () => {
    const rows = stockTable(data, "2026-03-31");
    expect(rows.map((r) => [r.category.id, r.total, r.monthChange])).toEqual([["vo", 80, -1], ["vs", 14, -1], ["vq", 40, 0], ["gu", 20, 0]]);
  });
  it("stock promedio diario", () => {
    // Del 1 al 10 de enero: 9 días con 155 y 1 día con 160 → 155,5
    expect(averageStock(data, "2026-01-01", "2026-01-10").avg).toBeCloseTo(155.5);
    expect(averageStock(data, "2025-12-01", "2026-01-01").days).toBe(1);
  });
  it("resumen de período por categorías con traslados", () => {
    const s = periodSummary(data, "2026-01-01", "2026-03-31", ["vo"]);
    expect(s.exits).toEqual({ venta: 4, muerte: 1, descarte: 0, egreso: 0 });
    expect(s.transfersIn).toBe(5);
    expect(s.balance).toBe(0);
    const cows = periodSummary(data, "2026-01-01", "2026-03-31", ["vo", "vs"]);
    expect(cows.transfersIn).toBe(0); // traslado entre categorías del mismo grupo no cuenta
  });
});

describe("indicadores", () => {
  const r = indicators(data, "2026-01-01", "2026-03-31");
  it("refugo = ventas + muertes + descartes sobre stock promedio", () => {
    expect(r.refugo).toBe(6);
    expect(r.refugoPct).toBeCloseTo((6 / r.avg) * 100);
    expect(r.refugoAnnual).toBeCloseTo((r.refugoPct! * 365) / 90);
    expect(r.saleCauses).toEqual([["Mastitis / problema de ubre", 4]]);
  });
  it("vacas: VO/VT y reposición", () => {
    expect(r.cows.vo).toBe(80);
    expect(r.cows.vt).toBe(94);
    expect(r.cows.voVt).toBeCloseTo((80 / 94) * 100);
    expect(r.cows.heifersPer100).toBeCloseTo((40 / 94) * 100);
    expect(r.cows.heifersNeeded).toBeCloseTo((r.cows.refugoYear! * 2) / 0.9);
  });
  it("composición por grupo", () => {
    expect(r.composition[0]).toEqual(["Ordeñe", 80]);
  });
  it("semáforo", () => {
    expect(level(22, 25, 30, "max")).toBe("ok");
    expect(level(28, 25, 30, "max")).toBe("warn");
    expect(level(82, 80, 75, "min")).toBe("ok");
    expect(level(null, 1, 2, "max")).toBe("none");
  });
  it("tendencia mensual desde el inventario", () => {
    const t = monthlyTrend(data, "2026-03-31", 4);
    expect(t.map((x) => x.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(t[0]).toMatchObject({ entries: 5, exits: 0, stock: 160 });
    expect(t[2]).toMatchObject({ exits: 2, stock: 154 });
  });
});

import { ageBuckets } from "../src/lib/ages";
import type { Animal } from "../src/lib/types";
describe("animales por días de nacido", () => {
  const mk = (id: string, birth: string | null, sexo: "H" | "M", status = "active"): Animal => ({ id, establishment_id: "e", tag: id, electronic_tag: null, sexo, birth_date: birth, mother_tag: null, father_tag: null, origin: null, current_category_id: "c", lot: null, status, birth_weight: null, notes: null, created_by: null, updated_at: "", deleted_at: null } as unknown as Animal);
  it("cuenta por rango con los rangos por defecto", () => {
    const r = ageBuckets([mk("a", "2026-10-31", "H"), mk("b", "2026-09-01", "M"), mk("c", "2026-09-01", "H"), mk("d", "2025-01-01", "H"), mk("e", "2026-10-01", "H", "sold"), mk("f", null, "M")], [], "2026-10-31");
    expect(r.buckets.map((b) => b.total)).toEqual([3, 0, 0, 0, 1]);
    expect(r.buckets[0].h).toBe(2); expect(r.active).toBe(5); expect(r.withoutDate).toBe(1); expect(r.outside).toBe(1);
  });
  it("usa los rangos del establecimiento", () => {
    const r = ageBuckets([mk("a", "2026-10-21", "H")], [{ label: "Hasta 15", min_days: 0, max_days: 15, sort_order: 1, active: true }], "2026-10-31");
    expect(r.buckets).toHaveLength(1); expect(r.buckets[0].total).toBe(1);
  });
});
