import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-2xl border border-emerald-200/70 bg-white px-4 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none disabled:bg-slate-50";
export const labelCls = "mb-1 block text-xs font-semibold text-slate-500";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-60";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit?: () => void;
  busy?: boolean;
  submitLabel?: string;
  submitClass?: string;
  submitDisabled?: boolean;
  /** Reemplaza los botones del pie (p. ej. un asistente por pasos). */
  footer?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
};

/** Contenedor de diálogo con el mismo estilo que los modales del Historial. */
export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  onSubmit,
  busy,
  submitLabel = "Guardar",
  submitClass = btnPrimary,
  submitDisabled,
  footer,
  size = "md",
  children,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-3 backdrop-blur"
          onClick={() => !busy && onClose()}
        >
          <motion.form
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`max-h-[92vh] w-full ${size === "lg" ? "max-w-3xl" : "max-w-xl"} overflow-y-auto rounded-3xl border border-white/30 bg-white/95 p-5 shadow-xl sm:p-6`}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && !submitDisabled) onSubmit?.();
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="Cerrar"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {footer ?? (
                <>
                  <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
                    Cancelar
                  </button>
                  {onSubmit && (
                    <button type="submit" disabled={busy || submitDisabled} className={submitClass}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {submitLabel}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
