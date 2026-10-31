import type { MovementType, Role, Sex } from "./types";

export const ROLE_LABEL: Record<Role, string> = { owner: "Propietario", manager: "Encargado", operator: "Operario", viewer: "Solo lectura" };
export const INVITABLE_ROLES: Exclude<Role, "owner">[] = ["operator", "manager", "viewer"];
export const canManage = (r: Role | null | undefined) => r === "owner" || r === "manager";
export const canOperate = (r: Role | null | undefined) => r === "owner" || r === "manager" || r === "operator";

export const SEX_LABEL: Record<Sex, string> = { H: "Hembras", M: "Machos" };

// Mismos tipos y reglas que la app Android (movementDelta).
export const MOVEMENT_TYPES: MovementType[] = ["Nacimiento", "Compra", "Traslado interno", "Venta", "Muerte", "Descarte", "Ingreso ajuste", "Egreso ajuste"];
export const ENTRY_TYPES: MovementType[] = ["Nacimiento", "Compra", "Ingreso ajuste"];
export const EXIT_TYPES: MovementType[] = ["Venta", "Muerte", "Descarte", "Egreso ajuste"];
export const needsOrigin = (t: MovementType) => EXIT_TYPES.includes(t) || t === "Traslado interno";
export const needsDestination = (t: MovementType) => ENTRY_TYPES.includes(t) || t === "Traslado interno";

/** Nombre simple para la pantalla del operario. */
export const TYPE_PLAIN: Record<MovementType, string> = {
  Nacimiento: "Nacimiento", Compra: "Compra", "Traslado interno": "Pasó de categoría", Venta: "Venta", Muerte: "Muerte",
  Descarte: "Descarte", "Ingreso ajuste": "Ajuste (suma)", "Egreso ajuste": "Ajuste (resta)",
};

export const CAUSES_SALE = [
  "Problema reproductivo / vaca vacía", "Patología podal / renguera", "Mastitis / problema de ubre", "Baja producción láctea",
  "Edad / fin de vida productiva", "Fractura / lesión / accidente", "Otra enfermedad / problema sanitario", "Venta a otro tambo / decisión comercial",
  "Exceso de stock / ajuste de rodeo", "Temperamento / manejo", "Otro motivo de venta",
];
export const CAUSES_DEATH = [
  "Lesión / accidente / problema locomotor", "Mastitis grave / septicemia", "Problema de parto / distocia / periparto", "Enfermedad respiratoria / neumonía",
  "Problema digestivo / diarrea / timpanismo / enteritis", "Problema metabólico (hipocalcemia, cetosis u otro)", "Septicemia / infección generalizada",
  "Problema umbilical o articular (terneros)", "Intoxicación / envenenamiento", "Estrés térmico / causa climática", "Otra enfermedad conocida", "Causa desconocida / sin diagnóstico",
];
export const CAUSES_OTHER = ["Cambio de etapa", "Descarte productivo", "Ingreso externo", "Ajuste inventario", "Otro"];
export function causesFor(t: MovementType) {
  if (t === "Venta") return CAUSES_SALE;
  if (t === "Muerte") return CAUSES_DEATH;
  if (t === "Descarte") return [...CAUSES_SALE.filter((c) => !/comercial|exceso/i.test(c)), "Descarte productivo"];
  if (t === "Traslado interno") return ["Cambio de etapa", "Parto", "Secado", "Servicio / preñez confirmada", "Otro"];
  return [];
}

// Grupos técnicos de las categorías (los mismos textos que guarda la app Android).
export const GROUPS = ["Ordeñe", "Seca", "Reposicion", "Recria", "Guachera"] as const;
export const GROUP_LABEL: Record<string, string> = { Ordeñe: "Vacas en ordeñe", Seca: "Vacas secas", Reposicion: "Reposición (vaquillonas)", Recria: "Recría", Guachera: "Guachera", "": "Sin grupo" };
export const COW_GROUPS = ["Ordeñe", "Seca"];

export const DEFAULT_CATEGORIES: [string, string][] = [
  ["Vacas Ordeñe", "Ordeñe"], ["Vacas Preparto", "Seca"], ["Vacas Secas", "Seca"], ["Vaquillona Preñada", "Reposicion"],
  ["Vaquillona Servicio", "Reposicion"], ["Recría", "Recria"], ["Acostumbramiento", "Recria"], ["Guachera", "Guachera"],
];

export const ANIMAL_ORIGINS = ["Nacimiento propio", "Compra", "Registro inicial", "Otro"];
export const ANIMAL_EVENT_TYPES = ["Pesaje", "Cambio de categoría", "Venta", "Muerte", "Descarte", "Observación"];
