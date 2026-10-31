import { describe, expect, it } from "vitest";
import { parseBulkMovements, parseType } from "../src/lib/bulk";
import type { Category } from "../src/lib/types";

const cats = [{ id: "a", name: "Vacas Ordeñe" }, { id: "b", name: "Vacas Secas" }, { id: "g", name: "Guachera" }] as Category[];

describe("carga masiva de movimientos", () => {
  it("reconoce tipos escritos de distintas formas", () => {
    expect(parseType("venta")).toBe("Venta");
    expect(parseType("Murió")).toBe("Muerte");
    expect(parseType("Pasó de categoría")).toBe("Traslado interno");
    expect(parseType("traslado")).toBe("Traslado interno");
    expect(parseType("Ajuste (suma)")).toBe("Ingreso ajuste");
    expect(parseType("robo")).toBeNull();
  });
  it("lee filas de Excel, saltea encabezado y valida", () => {
    const text = [
      "Fecha\tTipo\tOrigen\tDestino\tSexo\tCantidad\tCausa",
      "15/10/2026\tVenta\tvacas ordeñe\t\tH\t3\tMastitis / problema de ubre",
      "16/10/2026\tNacimiento\t\tGuachera\tM\t2",
      "17/10/2026\tTraslado\tVacas Ordeñe\tVacas Secas\tH\t5\tSecado",
      "18/10/2026\tVenta\t\t\tH\t1",
      "19/10/2026\tVenta\tToros\t\tH\t1",
      "40/10/2026\tVenta\tVacas Ordeñe\t\tH\t1",
      "20/10/2026\tTraslado\tGuachera\tGuachera\tH\t1",
    ].join("\n");
    const r = parseBulkMovements(text, cats, "2026-10-31");
    expect(r.map((x) => x.error === null)).toEqual([true, true, true, false, false, false, false]);
    expect(r[0].draft).toMatchObject({ tipo: "Venta", origin: "a", sexo: "H", cantidad: 3, fecha: "2026-10-15" });
    expect(r[1].draft).toMatchObject({ tipo: "Nacimiento", destination: "g", sexo: "M" });
    expect(r[2].summary).toContain("Vacas Ordeñe → Vacas Secas");
    expect(r[3].error).toMatch(/origen/);
    expect(r[4].error).toMatch(/Toros/);
    expect(r[5].error).toMatch(/Fecha/);
    expect(r[6].error).toMatch(/iguales/);
    expect(parseBulkMovements("15/10/2026;Venta;Vacas Ordeñe;;H;1", cats, "2026-10-31", "2026-10-20")[0].error).toMatch(/inventario/);
  });
});
