import { needsDestination, needsOrigin } from "./catalog";
import { nowTime, today } from "./dates";
import type { Category, Movement, MovementType, Sex } from "./types";

export type MovementDraft = { tipo: MovementType; origin: string | null; destination: string | null; sexo: Sex; cantidad: number; fecha: string; causa: string; rp: string; observacion: string };

/** Mismas validaciones que la app Android (validateMovement). */
export function validateDraft(d: MovementDraft, on = today(), inventoryDate?: string): string | null {
  if (!d.fecha || !d.tipo || !(d.cantidad > 0)) return "Completá fecha, tipo y cantidad.";
  if (!Number.isInteger(d.cantidad)) return "La cantidad debe ser un número entero.";
  if (d.fecha > on) return "La fecha no puede ser futura.";
  if (inventoryDate && d.fecha < inventoryDate) return "La fecha es anterior al inventario inicial: no contaría para el stock.";
  if (needsOrigin(d.tipo) && !d.origin) return d.tipo === "Traslado interno" ? "Indicá de qué categoría salen." : "Indicá la categoría de origen.";
  if (needsDestination(d.tipo) && !d.destination) return d.tipo === "Traslado interno" ? "Indicá a qué categoría pasan." : "Indicá la categoría de destino.";
  if (d.tipo === "Traslado interno" && d.origin === d.destination) return "Origen y destino no pueden ser iguales.";
  return null;
}

/** Fila lista para guardar en simple_stock_movements (con nombres de categoría como la app Android). */
export function buildMovement(d: MovementDraft, establishmentId: string, categories: Category[], responsable: string, existing?: Movement): Movement {
  const name = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name ?? null : null);
  const origin = needsOrigin(d.tipo) ? d.origin : null;
  const destination = needsDestination(d.tipo) ? d.destination : null;
  return {
    id: existing?.id ?? crypto.randomUUID(),
    establishment_id: establishmentId,
    origin_category_id: origin, destination_category_id: destination,
    origen: name(origin), destino: name(destination),
    fecha: d.fecha, hora: existing?.hora ?? nowTime(), tipo: d.tipo, sexo: d.sexo, cantidad: Math.round(d.cantidad),
    rp: d.rp.trim() || null, causa: d.causa.trim() || null, responsable: existing?.responsable ?? (responsable || null),
    observacion: d.observacion.trim(), updated_at: new Date().toISOString(), deleted_at: null,
  };
}

export function draftFrom(m: Movement): MovementDraft {
  return { tipo: m.tipo, origin: m.origin_category_id, destination: m.destination_category_id, sexo: m.sexo, cantidad: m.cantidad, fecha: m.fecha, causa: m.causa ?? "", rp: m.rp ?? "", observacion: m.observacion ?? "" };
}

/** Texto corto: "Venta · 3 hembras de Vacas Ordeñe". */
export function describeMovement(m: Pick<Movement, "tipo" | "cantidad" | "sexo" | "origen" | "destino">) {
  const qty = `${m.cantidad} ${m.sexo === "H" ? (m.cantidad === 1 ? "hembra" : "hembras") : m.cantidad === 1 ? "macho" : "machos"}`;
  if (m.tipo === "Traslado interno") return `${qty} de ${m.origen ?? "?"} a ${m.destino ?? "?"}`;
  if (needsOrigin(m.tipo)) return `${qty} de ${m.origen ?? "?"}`;
  return `${qty} a ${m.destino ?? "?"}`;
}
