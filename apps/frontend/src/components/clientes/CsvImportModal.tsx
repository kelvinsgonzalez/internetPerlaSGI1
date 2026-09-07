import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    file: File
  ) => Promise<{ inserted: number; conflicts: number } | void>;
}

type Formato = "csv" | "json";

// Mismas columnas que reconoce el backend al importar.
const COLUMNAS = [
  "nombre",
  "direccion",
  "telefono",
  "ip",
  "latitud",
  "longitud",
  "plan",
  "notas",
];

const EJEMPLO_FILAS = [
  {
    nombre: "Ana Pérez López",
    direccion: "4a calle 5-23, zona 1",
    telefono: "55501111",
    ip: "10.0.0.11",
    latitud: "14.634900",
    longitud: "-90.506900",
    plan: "Plan 20MB",
    notas: "Cliente desde 2024",
  },
  {
    nombre: "Beto Ruiz",
    direccion: "Colonia El Bosque casa 12",
    telefono: "55502222",
    ip: "10.0.0.12",
    latitud: "14.640000",
    longitud: "-90.510000",
    plan: "Plan 10MB",
    notas: "",
  },
];

// Se entrecomilla solo lo necesario: valores con coma, comillas o saltos.
const campoCsv = (valor: string) =>
  /[",\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;

const EJEMPLO_CSV = [
  COLUMNAS.join(","),
  ...EJEMPLO_FILAS.map((fila) =>
    COLUMNAS.map((c) => campoCsv((fila as any)[c] ?? "")).join(",")
  ),
].join("\n");

const EJEMPLO_JSON = JSON.stringify(EJEMPLO_FILAS, null, 2);

const descargar = (contenido: string, nombre: string, tipo: string) => {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function CsvImportModal({ open, onClose, onSubmit }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [formatoTab, setFormatoTab] = useState<Formato>("csv");

  const reset = () => {
    setMissing([]);
    setError(null);
  };

  // Revisa la cabecera (CSV) o las claves del primer registro (JSON) para
  // avisar antes de subir. Mismos nombres alternativos que acepta el backend.
  const revisarCampos = (campos: string[]) => {
    const headers = campos.map((h) => h.trim().toLowerCase()).filter(Boolean);
    const hasAny = (alts: string[]) => alts.some((h) => headers.includes(h));
    const missingList: string[] = [];
    if (!hasAny(["ip", "ipasignada", "ip_asignada"]))
      missingList.push("ip/ipAsignada/ip_asignada");
    if (!hasAny(["name", "nombre"])) missingList.push("name/nombre");
    if (!hasAny(["phone", "telefono"])) missingList.push("phone/telefono");
    if (!hasAny(["address", "direccion"])) missingList.push("address/direccion");
    if (!headers.includes("latitud")) missingList.push("latitud");
    if (!headers.includes("longitud")) missingList.push("longitud");
    if (!hasAny(["plan", "plandeinternet", "plan_de_internet"]))
      missingList.push("plan/planDeInternet/plan_de_internet");
    setMissing(missingList);
  };

  const handleFileChange = (f: File | null) => {
    setFile(f);
    reset();
    if (!f) return;

    const esJson = f.name.toLowerCase().endsWith(".json");
    setFormatoTab(esJson ? "json" : "csv");

    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result || "");
      try {
        if (esJson) {
          const parsed = JSON.parse(texto);
          const lista = Array.isArray(parsed)
            ? parsed
            : parsed?.clientes ?? parsed?.customers ?? parsed?.data;
          if (!Array.isArray(lista) || lista.length === 0) {
            setError(
              "El JSON debe ser una lista de clientes: [ { \"nombre\": ... }, ... ]"
            );
            return;
          }
          const claves = new Set<string>();
          for (const item of lista) {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              Object.keys(item).forEach((k) => claves.add(k));
            }
          }
          revisarCampos([...claves]);
          return;
        }

        const primera =
          texto.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
        // El backend solo acepta la coma como separador.
        if (!primera.includes(",") && /[;\t]/.test(primera)) {
          const usado = primera.includes(";") ? '";"' : "tabulaciones";
          setError(
            `Este CSV usa ${usado} como separador y solo se acepta la coma (","). ` +
              "Descarga el ejemplo de abajo y vuelve a exportar el archivo con comas."
          );
          return;
        }
        revisarCampos(primera.split(","));
      } catch {
        if (esJson) setError("El archivo JSON no es válido: no se pudo leer.");
      }
    };
    reader.readAsText(f);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!file) {
      setError("Selecciona un archivo CSV o JSON.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(file);
      onClose();
      setFile(null);
      setMissing([]);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al importar el archivo");
    } finally {
      setSubmitting(false);
    }
  };

  const tabClass = (f: Formato) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      formatoTab === f
        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
        : "text-slate-400 border border-transparent hover:text-slate-200"
    }`;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-800/80 backdrop-blur-lg border border-slate-700 shadow-2xl shadow-emerald-500/20 text-white"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
            <div className="border-b border-slate-700 p-6">
              <h3 className="text-2xl font-semibold text-emerald-400">
                Importar clientes desde CSV o JSON
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Campos soportados: {COLUMNAS.join(", ")}.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg bg-rose-500/20 p-3 text-sm text-rose-300 border border-rose-500/30">
                  {error}
                </div>
              )}
              <div className="p-6 border-2 border-dashed border-slate-600 rounded-xl text-center">
                <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/20 file:text-emerald-300 hover:file:bg-emerald-500/30"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </div>
              {missing.length > 0 && (
                <div className="rounded-lg bg-amber-500/20 p-3 text-sm text-amber-300 border border-amber-500/30">
                  Advertencia: Faltan los campos: {missing.join(", ")}. La importación continuará y los campos se dejarán vacíos.
                </div>
              )}

              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 mr-1">Formato requerido:</span>
                  <button type="button" className={tabClass("csv")} onClick={() => setFormatoTab("csv")}>
                    CSV
                  </button>
                  <button type="button" className={tabClass("json")} onClick={() => setFormatoTab("json")}>
                    JSON
                  </button>
                </div>

                {formatoTab === "csv" ? (
                  <>
                    <p className="text-xs text-slate-400">
                      Archivo <code className="text-emerald-300">.csv</code> separado por comas
                      (<code className="text-emerald-300">,</code>). No se acepta el punto y coma
                      (<code className="text-rose-300">;</code>) que exporta Excel en español.
                      La primera fila son los nombres de las columnas y los valores que
                      contengan comas van entre comillas dobles.
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-300">
{EJEMPLO_CSV}
                    </pre>
                    <button
                      type="button"
                      className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                      onClick={() =>
                        descargar(EJEMPLO_CSV, "ejemplo-clientes.csv", "text/csv;charset=utf-8")
                      }
                    >
                      Descargar ejemplo CSV
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-400">
                      Archivo <code className="text-emerald-300">.json</code> con una lista de
                      objetos; cada objeto es un cliente y cada clave una de las columnas
                      soportadas. Todos los valores se leen como texto.
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-300">
{EJEMPLO_JSON}
                    </pre>
                    <button
                      type="button"
                      className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                      onClick={() =>
                        descargar(EJEMPLO_JSON, "ejemplo-clientes.json", "application/json;charset=utf-8")
                      }
                    >
                      Descargar ejemplo JSON
                    </button>
                  </>
                )}
              </div>

              <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400 border border-emerald-500/20">
                Los duplicados se detectan por combinación de nombre + dirección. Los conflictos se registran para revisión.
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-700 p-6">
                <motion.button
                    className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                    onClick={onClose}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                    Cancelar
                </motion.button>
                <motion.button
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-all"
                    onClick={handleSubmit}
                    disabled={submitting}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                    {submitting ? "Importando..." : "Importar Archivo"}
                </motion.button>
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
