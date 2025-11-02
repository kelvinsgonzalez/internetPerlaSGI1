import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    file: File
  ) => Promise<{ inserted: number; conflicts: number } | void>;
}

export default function CsvImportModal({ open, onClose, onSubmit }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setMissing([]);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text =
          String(reader.result || "")
            .split(/\r?\n/)
            .find((l) => l.trim().length > 0) || "";
        const headers = text
          .split(",")
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean);
        const hasAny = (alts: string[]) =>
          alts.some((h) => headers.includes(h));
        const missingList: string[] = [];
        if (!hasAny(["ip", "ipasignada", "ip_asignada"]))
          missingList.push("ip/ipAsignada/ip_asignada");
        if (!hasAny(["name", "nombre"])) missingList.push("name/nombre");
        if (!hasAny(["phone", "telefono"])) missingList.push("phone/telefono");
        if (!hasAny(["address", "direccion"]))
          missingList.push("address/direccion");
        if (!headers.includes("latitud")) missingList.push("latitud");
        if (!headers.includes("longitud")) missingList.push("longitud");
        if (!hasAny(["plan", "plandeinternet", "plan_de_internet"]))
          missingList.push("plan/planDeInternet/plan_de_internet");
        setMissing(missingList);
      } catch {
        setMissing([]);
      }
    };
    reader.readAsText(f);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!file) {
      setError("Selecciona un archivo CSV.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(file);
      onClose();
      setFile(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al importar CSV");
    } finally {
      setSubmitting(false);
    }
  };

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
              className="w-full max-w-lg rounded-2xl bg-slate-800/80 backdrop-blur-lg border border-slate-700 shadow-2xl shadow-emerald-500/20 text-white"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
            <div className="border-b border-slate-700 p-6">
              <h3 className="text-2xl font-semibold text-emerald-400">
                Importar clientes desde CSV
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Columnas soportadas: ip, nombre, telefono, direccion, latitud, longitud, plan.
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
                    accept=".csv"
                    className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/20 file:text-emerald-300 hover:file:bg-emerald-500/30"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </div>
              {missing.length > 0 && (
                <div className="rounded-lg bg-amber-500/20 p-3 text-sm text-amber-300 border border-amber-500/30">
                  Advertencia: Faltan las columnas: {missing.join(", ")}. La importación continuará y los campos se dejarán vacíos.
                </div>
              )}
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
