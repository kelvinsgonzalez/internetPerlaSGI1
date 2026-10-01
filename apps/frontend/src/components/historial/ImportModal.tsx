import { AnimatePresence, motion } from "framer-motion";
import { Check, FileJson, FileSpreadsheet, FileUp, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { confirmarImport, previsualizarImport, type ImportPreview } from "../../services/historial";
import { descargarEjemploJSON, descargarPlantillaExcel } from "./plantillas";

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

/**
 * Lee el archivo como texto. Excel en Windows guarda los CSV en Windows-1252:
 * si la lectura UTF-8 trae caracteres inválidos, se reintenta con ese juego.
 */
async function leerTexto(file: File) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  const texto = utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
  return texto.replace(/^﻿/, "");
}

/** Separador más frecuente (fuera de comillas) en la primera línea. */
function detectarSeparador(texto: string) {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  const cuenta: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let enComillas = false;
  for (const ch of primera) {
    if (ch === '"') enComillas = !enComillas;
    else if (!enComillas && ch in cuenta) cuenta[ch] += 1;
  }
  const [mejor, veces] = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
  return veces > 0 ? mejor : ",";
}

/** CSV con comillas ("a, b" y "" escapadas) y UN solo separador. */
function parseCSV(texto: string): Record<string, string>[] {
  const sep = detectarSeparador(texto);
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const ch = texto[i];
    if (enComillas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (ch === '"') enComillas = false;
      else campo += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === sep) {
      fila.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i += 1;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += ch;
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const [encabezados, ...datos] = filas.filter((f) => f.some((c) => c.trim() !== ""));
  if (!encabezados) return [];
  return datos.map((f) => Object.fromEntries(encabezados.map((h, i) => [h.trim(), f[i] ?? ""])));
}

async function leerArchivo(file: File): Promise<Record<string, unknown>[]> {
  const texto = await leerTexto(file);
  if (file.name.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(texto);
    const lista = Array.isArray(data) ? data : data?.registros;
    if (!Array.isArray(lista)) throw new Error("El JSON debe ser una lista de registros");
    return lista;
  }
  return parseCSV(texto);
}

const ESTADO: Record<string, { label: string; cls: string }> = {
  ok: { label: "Nuevo", cls: "bg-emerald-100 text-emerald-700" },
  duplicado: { label: "Duplicado", cls: "bg-amber-100 text-amber-700" },
  invalido: { label: "Sin cliente", cls: "bg-red-100 text-red-700" },
};

export default function ImportModal({ open, onClose, onImported }: Props) {
  const [archivo, setArchivo] = useState<string>("");
  const [registros, setRegistros] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [omitir, setOmitir] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(false);

  const reset = () => {
    setArchivo("");
    setRegistros([]);
    setPreview(null);
    setOmitir(new Set());
  };

  const cerrar = () => {
    if (cargando) return;
    reset();
    onClose();
  };

  const elegir = async (file?: File) => {
    if (!file) return;
    setCargando(true);
    try {
      const filas = await leerArchivo(file);
      if (!filas.length) throw new Error("El archivo no tiene registros");
      const p = await previsualizarImport(filas);
      setArchivo(file.name);
      setRegistros(filas);
      setPreview(p);
      // Los duplicados vienen marcados para omitir; el admin decide.
      setOmitir(new Set(p.filas.filter((f) => f.estado === "duplicado").map((f) => f.indice)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "No se pudo leer el archivo");
    } finally {
      setCargando(false);
    }
  };

  const aInsertar = useMemo(
    () => (preview ? preview.filas.filter((f) => f.estado !== "invalido" && !omitir.has(f.indice)).length : 0),
    [preview, omitir]
  );

  const confirmar = async () => {
    setCargando(true);
    try {
      const r = await confirmarImport(registros, [...omitir]);
      toast.success(`Importados ${r.insertados} registros (${r.omitidos} omitidos)`);
      reset();
      onImported();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "No se pudo importar");
    } finally {
      setCargando(false);
    }
  };

  const toggle = (indice: number) =>
    setOmitir((prev) => {
      const next = new Set(prev);
      if (next.has(indice)) next.delete(indice);
      else next.add(indice);
      return next;
    });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur"
          onClick={cerrar}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-white/30 bg-white/95 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="import-title" className="text-lg font-semibold text-slate-900">
              Importar registros
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Archivo <b>.csv</b> (separado por coma, punto y coma o tabulador) o <b>.json</b>. Columnas: Id,
              Cliente, Ubicación, Concepto, Fecha, Meses_Cancelados, Cantidad_Meses_pagados, Total, Forma de pago
              (o Comentarios), Cobrador, Codigo. Los valores se guardan como texto, tal cual. Los registros se agrupan por el
              nombre exacto del cliente.
            </p>

            {!preview && (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                <p className="text-sm font-semibold text-slate-800">¿No sabes cómo debe ir el archivo? Descarga un ejemplo:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={descargarPlantillaExcel}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Plantilla Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={descargarEjemploJSON}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
                  >
                    <FileJson className="h-4 w-4" /> Ejemplo JSON
                  </button>
                </div>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
                  <li>Abre la plantilla en Excel, borra las filas de ejemplo y escribe tus datos debajo de los encabezados (no los cambies).</li>
                  <li>
                    Guárdala como CSV: <b>Archivo › Guardar como › CSV UTF-8 (delimitado por comas)</b>. También sirve
                    &quot;CSV (delimitado por comas)&quot;, aunque use punto y coma.
                  </li>
                  <li>Sube aquí el .csv. Las columnas ya vienen en formato texto: Excel no cambia fechas ni montos.</li>
                </ol>
              </div>
            )}

            {!preview && (
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-6 py-10 text-sm text-slate-600 hover:bg-emerald-50">
                {cargando ? (
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                ) : (
                  <FileUp className="h-6 w-6 text-emerald-600" />
                )}
                {cargando ? "Analizando..." : "Elegir archivo"}
                <input
                  type="file"
                  accept=".csv,.json,.txt"
                  className="hidden"
                  disabled={cargando}
                  onChange={(e) => {
                    elegir(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}

            {preview && (
              <>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{archivo}</span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                    {preview.resumen.validos} nuevos
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                    {preview.resumen.duplicados} duplicados
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                    {preview.resumen.invalidos} sin cliente
                  </span>
                </div>
                <div className="mt-3 flex-1 overflow-auto rounded-2xl border border-slate-100">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Importar</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Código</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.filas.map((f) => (
                        <tr key={f.indice} className="border-t border-slate-100">
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              aria-label={`Importar fila ${f.indice + 1}`}
                              disabled={f.estado === "invalido"}
                              checked={f.estado !== "invalido" && !omitir.has(f.indice)}
                              onChange={() => toggle(f.indice)}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${ESTADO[f.estado].cls}`}>
                              {ESTADO[f.estado].label}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">{f.datos.cliente ?? "—"}</td>
                          <td className="px-3 py-1.5">{f.datos.fecha ?? "—"}</td>
                          <td className="px-3 py-1.5">{f.datos.total ?? "—"}</td>
                          <td className="px-3 py-1.5">{f.datos.codigo ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={preview ? reset : cerrar}
                disabled={cargando}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <X className="h-4 w-4" /> {preview ? "Elegir otro archivo" : "Cancelar"}
              </button>
              {preview && (
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={cargando || aInsertar === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-60"
                >
                  {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Importar {aInsertar}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
