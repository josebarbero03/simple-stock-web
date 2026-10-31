import { describe, expect, it } from "vitest";
import { buildMovement, describeMovement, validateDraft, type MovementDraft } from "../src/lib/movements";
import type { Category } from "../src/lib/types";

const cats = [{ id: "a", name: "Vacas Ordeñe" }, { id: "b", name: "Vacas Secas" }] as Category[];
const base: MovementDraft = { tipo: "Venta", origin: "a", destination: null, sexo: "H", cantidad: 2, fecha: "2026-10-30", causa: "Mastitis / problema de ubre", rp: "", observacion: "" };

describe("movimientos", () => {
  it("valida como la app Android", () => {
    expect(validateDraft(base, "2026-10-31")).toBeNull();
    expect(validateDraft({ ...base, origin: null }, "2026-10-31")).toMatch(/origen/);
    expect(validateDraft({ ...base, tipo: "Nacimiento", destination: null }, "2026-10-31")).toMatch(/destino/);
    expect(validateDraft({ ...base, tipo: "Traslado interno", destination: "a" }, "2026-10-31")).toMatch(/iguales/);
    expect(validateDraft({ ...base, cantidad: 0 }, "2026-10-31")).toMatch(/cantidad/);
    expect(validateDraft({ ...base, cantidad: 1.5 }, "2026-10-31")).toMatch(/entero/);
    expect(validateDraft({ ...base, fecha: "2026-11-02" }, "2026-10-31")).toMatch(/futura/);
    expect(validateDraft(base, "2026-10-31", "2026-10-31")).toMatch(/inventario/);
  });
  it("arma la fila con nombres de categoría y sin el lado que no corresponde", () => {
    const m = buildMovement({ ...base, destination: "b" }, "e", cats, "Juan");
    expect(m).toMatchObject({ establishment_id: "e", origin_category_id: "a", destination_category_id: null, origen: "Vacas Ordeñe", destino: null, responsable: "Juan", cantidad: 2, deleted_at: null });
    const t = buildMovement({ ...base, tipo: "Traslado interno", destination: "b" }, "e", cats, "Juan");
    expect([t.origen, t.destino]).toEqual(["Vacas Ordeñe", "Vacas Secas"]);
  });
  it("describe en lenguaje simple", () => {
    expect(describeMovement({ tipo: "Venta", cantidad: 1, sexo: "H", origen: "Vacas Ordeñe", destino: null })).toBe("1 hembra de Vacas Ordeñe");
    expect(describeMovement({ tipo: "Traslado interno", cantidad: 3, sexo: "M", origen: "Guachera", destino: "Recría" })).toBe("3 machos de Guachera a Recría");
  });
});
