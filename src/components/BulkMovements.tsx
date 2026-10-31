import { useMemo, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import type { SaveMovements } from "../hooks/useStockData";
import { parseBulkMovements } from "../lib/bulk";
import { today } from "../lib/dates";
import { buildMovement } from "../lib/movements";
import type { StockData } from "../lib/stock";
import type { Establishment } from "../lib/types";
import { Button, Card, Textarea, toast } from "./ui";

const COLUMNS = ["Fecha", "Tipo", "Categoría origen", "Categoría destino", "Sexo (H/M)", "Cantidad", "Causa", "Caravana / RP", "Observación"];

export function BulkMovements({ est, data, responsable, save }: { est: Establishment; data: StockData; responsable: string; save: SaveMovements }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => parseBulkMovements(text, data.categories, today(), data.inventoryDate), [text, data.categories, data.inventoryDate]);
  const valid = rows.filter((r) => r.draft);
  const first = data.categories[0]?.name ?? "Vacas Ordeñe", second = data.categories[1]?.name ?? "Vacas Secas", last = data.categories.at(-1)?.name ?? "Guachera";

  function template() {
    const csv = "﻿" + [COLUMNS.join(";"), `15/10/2026;Venta;${first};;H;2;Mastitis / problema de ubre;;`, `16/10/2026;Nacimiento;;${last};M;1;;;`, `17/10/2026;Traslado interno;${first};${second};H;3;Secado;;`].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "plantilla-movimientos.csv"; a.click(); URL.revokeObjectURL(url);
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) { toast.error("Subí un archivo .csv. En Excel: Archivo → Guardar como → CSV."); return; }
    setText(await file.text());
  }
  async function upload() {
    setSaving(true);
    const r = await save(valid.map((x) => buildMovement(x.draft!, est.id, data.categories, responsable)));
    setSaving(false);
    if (r === "error") return;
    toast.ok(r === "queued" ? `${valid.length} movimientos guardados sin señal` : `${valid.length} movimientos cargados`);
    setText("");
  }

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-black">Carga masiva de movimientos</h1><p className="text-sm text-slate-600">Pegá desde Excel o subí un CSV · {est.name}</p></div>
    <Card className="space-y-3">
      <div className="text-sm text-slate-600"><p>Columnas en este orden:</p><ol className="mt-1 flex flex-wrap gap-1.5">{COLUMNS.map((c, i) => <li key={c} className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-800">{i + 1}. {c}</li>)}</ol>
        <p className="mt-2">Ventas, muertes y descartes llevan categoría de origen; nacimientos y compras, de destino; los traslados, las dos. Los nombres de categoría tienen que coincidir con los de este establecimiento.</p></div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <button type="button" onClick={template} className="inline-flex items-center gap-2 text-sm font-bold text-brand"><Download className="size-4" />Descargar plantilla</button>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-brand"><FileUp className="size-4" />Subir archivo CSV<input type="file" accept=".csv,.txt,.tsv,text/csv" onChange={(e) => void readFile(e)} className="hidden" /></label>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={`15/10/2026\tVenta\t${first}\t\tH\t2\tMastitis / problema de ubre`} className="font-mono text-sm" aria-label="Datos a cargar" />
    </Card>
    {rows.length ? <div>
      <p className="mb-2 flex flex-wrap gap-x-4 text-sm font-bold"><span className="text-brand-dark">{valid.length} listos</span>{rows.length - valid.length ? <span className="text-rose-600">{rows.length - valid.length} con errores (no se cargan)</span> : null}</p>
      <ul className="max-h-80 overflow-y-auto rounded-xl border border-[#dce5e1] bg-white text-sm">{rows.map((r) => <li key={r.line} className={`flex items-start gap-2 border-b border-[#edf2f0] px-3 py-2 last:border-0 ${r.error ? "bg-rose-50/60" : ""}`}>
        {r.error ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />}
        {r.error ? <span className="min-w-0"><span className="text-slate-500">Fila {r.line}:</span> <span className="font-semibold text-rose-700">{r.error}</span><span className="block truncate font-mono text-xs text-slate-400">{r.raw}</span></span> : <span className="min-w-0">{r.summary}</span>}
      </li>)}</ul>
    </div> : null}
    <div className="flex justify-end"><Button onClick={() => void upload()} loading={saving} disabled={!valid.length}>{!saving ? <Upload /> : null}Cargar {valid.length || ""} movimientos</Button></div>
  </div>;
}
