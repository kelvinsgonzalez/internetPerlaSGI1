import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FRASE_BORRAR_TODO } from "../../services/historial";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Ejecuta el borrado; el modal se encarga de las dos confirmaciones. */
  onConfirm: () => Promise<void>;
};

/**
 * Doble confirmación para vaciar el historial:
 * 1) aviso de lo que se va a perder;
 * 2) escribir la frase exacta. El backend vuelve a exigir esa frase.
 */
export default function BorrarTodoModal({ open, onClose, onConfirm }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [frase, setFrase] = useState("");
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    if (open) {
      setPaso(1);
      setFrase("");
      setBorrando(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !borrando && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, borrando, onClose]);

  const fraseOk = frase.trim() === FRASE_BORRAR_TODO;

  const borrar = async () => {
    if (!fraseOk) return;
    setBorrando(true);
    try {
      await onConfirm();
    } finally {
      setBorrando(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => !borrando && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="borrar-todo-titulo"
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <div className="flex items-start justify-between gap-3 bg-red-600 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 shrink-0" />
                <div>
                  <h2 id="borrar-todo-titulo" className="text-lg font-bold leading-tight">
                    Borrar todo el historial
                  </h2>
                  <p className="text-xs text-red-100">Confirmación {paso} de 2</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={borrando}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {paso === 1 ? (
              <div className="space-y-4 p-5">
                <p className="text-sm text-slate-700">
                  Se eliminarán <b>todos los registros de cobros</b> de todos los clientes. Úsalo sólo para
                  refrescar la base y volver a importar el historial completo.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                  <li>La acción <b>no se puede deshacer</b>.</li>
                  <li>Descarga o guarda tu archivo de origen antes de continuar.</li>
                  <li>Quedará registrada en la bitácora de auditoría.</li>
                </ul>
                <div className="flex justify-end gap-2">
                  <button
                    autoFocus
                    onClick={onClose}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setPaso(2)}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Sí, continuar
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="space-y-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  borrar();
                }}
              >
                <p className="text-sm text-slate-700">
                  Para confirmar por segunda vez, escribe <b className="font-mono text-red-700">{FRASE_BORRAR_TODO}</b>:
                </p>
                <input
                  autoFocus
                  value={frase}
                  onChange={(e) => setFrase(e.target.value)}
                  disabled={borrando}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Escribe ${FRASE_BORRAR_TODO} para confirmar`}
                  placeholder={FRASE_BORRAR_TODO}
                  className="w-full rounded-xl border border-red-200 bg-white px-4 py-2 font-mono text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPaso(1)}
                    disabled={borrando}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={!fraseOk || borrando}
                    className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {borrando ? "Borrando…" : "Borrar todo"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
