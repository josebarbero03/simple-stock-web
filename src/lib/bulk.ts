import { MOVEMENT_TYPES, TYPE_PLAIN } from "./catalog";
import { validateDraft, type MovementDraft } from "./movements";
import type { Category, MovementType, Sex } from "./types";

export type BulkRow = { line: number; raw: string; draft: MovementDraft | null; error: string | null; summary: string };

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function parseDate(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const build = (y: number, mo: number, d: number) => { const dt = new Date(Date.UTC(y, mo - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null; };
  if (m) return build(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return build(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

export function parseType(value: string): MovementType | null {
  const v = norm(value);
  if (!v) return null;
  const direct = MOVEMENT_TYPES.find((t) => norm(t) === v || norm(TYPE_PLAIN[t]) === v);
  if (direct) return direct;
  if (/^(traslado|paso|cambio)/.test(v)) return "Traslado interno";
  if (/^naci/.test(v)) return "Nacimiento";
  if (/^compr/.test(v)) return "Compra";
  if (/^vent|^vendi/.test(v)) return "Venta";
  if (/^muer|^muri/.test(v)) return "Muerte";
  if (/^descart/.test(v)) return "Descarte";
  if (/ingreso|suma/.test(v)) return "Ingreso ajuste";
  if (/egreso|resta/.test(v)) return "Egreso ajuste";
  return null;
}

function parseSex(value: string): Sex | null {
  const v = norm(value);
  if (!v || v === "h" || v.startsWith("hem")) return "H";
  if (v === "m" || v.startsWith("mac")) return "M";
  return null;
}

/** Columnas: Fecha · Tipo · Categoría origen · Categoría destino · Sexo · Cantidad · Causa · Caravana/RP · Observación */
export function parseBulkMovements(text: string, categories: Category[], on: string, inventoryDate?: string): BulkRow[] {
  const lines = text.replace(/\r/g, "").split("\n").map((raw, i) => ({ raw, line: i + 1 })).filter((l) => l.raw.trim());
  if (!lines.length) return [];
  const sep = lines[0].raw.includes("\t") ? "\t" : lines[0].raw.includes(";") ? ";" : ",";
  const byName = new Map(categories.map((c) => [norm(c.name), c]));
  const rows = lines.map(({ raw, line }) => ({ raw, line, cells: raw.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")) }));
  const body = /^fecha/i.test(rows[0].cells[0] ?? "") ? rows.slice(1) : rows;
  return body.map(({ raw, line, cells }) => {
    const [f = "", t = "", o = "", d = "", s = "", q = "", causa = "", rp = "", obs = ""] = cells;
    const fail = (error: string): BulkRow => ({ line, raw, draft: null, error, summary: "" });
    const fecha = parseDate(f);
    if (!fecha) return fail(`Fecha "${f}" no válida (dd/mm/aaaa)`);
    const tipo = parseType(t);
    if (!tipo) return fail(`Tipo "${t}" no reconocido`);
    const origin = o ? byName.get(norm(o)) : undefined;
    const destination = d ? byName.get(norm(d)) : undefined;
    if (o && !origin) return fail(`No existe la categoría "${o}"`);
    if (d && !destination) return fail(`No existe la categoría "${d}"`);
    const sexo = parseSex(s);
    if (!sexo) return fail(`Sexo "${s}" no válido (H o M)`);
    const cantidad = Number(q.replace(",", "."));
    const draft: MovementDraft = { tipo, origin: origin?.id ?? null, destination: destination?.id ?? null, sexo, cantidad, fecha, causa, rp, observacion: obs };
    const problem = validateDraft(draft, on, inventoryDate);
    if (problem) return fail(problem);
    const where = tipo === "Traslado interno" ? `${origin!.name} → ${destination!.name}` : origin?.name ?? destination?.name ?? "";
    return { line, raw, draft, error: null, summary: `${f} · ${TYPE_PLAIN[tipo]} · ${cantidad} ${sexo === "H" ? "H" : "M"} · ${where}${causa ? ` · ${causa}` : ""}` };
  });
}
