import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CobroHistorico, CobroInput } from "../../services/historial";

type Props = {
  open: boolean;
  /** Registro a editar; si es null, es un alta. */
  registro: CobroHistorico | null;
  /** Cliente precargado al agregar desde una ficha. */
  clienteInicial?: string;
  onClose: () => void;
  onSave: (input: CobroInput) => Promise<void>;
};

const CAMPOS: { key: keyof CobroInput; label: string; placeholder?: string }[] = [
  { key: "cliente", label: "Cliente *" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "codigo", label: "Código" },
  { key: "fecha", label: "Fecha", placeholder: "1/10/2022 16:41:31" },
  { key: "concepto", label: "Concepto" },
  { key: "mesesCancelados", label: "Meses cancelados", placeholder: "Abril Mayo" },
  { key: "cantidadMeses", label: "Cant. meses" },
  { key: "total", label: "Total" },
  { key: "formaPago", label: "Forma de pago" },
  { key: "cobrador", label: "Cobrador" },
  { key: "extId", label: "Id (opcional)" },
];

const inputCls =
  "w-full rounded-2xl border border-emerald-200/70 bg-white px-4 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none";

export default function RegistroModal({ open, registro, clienteInicial, onClose, onSave }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base: Record<string, string> = {};
    CAMPOS.forEach(({ key }) => {
      base[key] = (registro?.[key as keyof CobroHistorico] as string | null) ?? "";
    });
    if (!registro && clienteInicial) base.cliente = clienteInicial;
    setForm(base);
  }, [open, registro, clienteInicial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente?.trim()) return;
    setSaving(true);
    try {
      // Todo se envía como texto tal cual se escribió.
      await onSave(form as unknown as CobroInput);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur"
          onClick={() => !saving && onClose()}
        >
          <motion.form
            role="dialog"
            aria-modal="true"
            aria-labelledby="registro-title"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/30 bg-white/95 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
          >
            <h3 id="registro-title" className="mb-4 text-lg font-semibold text-slate-900">
              {registro ? "Editar registro" : "Nuevo registro"}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPOS.map(({ key, label, placeholder }) => (
                <div key={key} className={key === "cliente" ? "sm:col-span-2" : ""}>
                  <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor={`reg-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`reg-${key}`}
                    className={inputCls}
                    placeholder={placeholder}
                    required={key === "cliente"}
                    value={form[key] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
