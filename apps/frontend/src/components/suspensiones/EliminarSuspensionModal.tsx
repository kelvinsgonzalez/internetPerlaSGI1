import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { eliminarSuspension, errorMsg, type Suspension } from "../../services/suspensiones";
import Modal, { inputCls, labelCls } from "./Modal";

type Props = { suspension: Suspension | null; onClose: () => void; onDeleted: () => void };

/** Sólo ADMIN. El registro sale de la base, pero su historia completa queda en el log TXT. */
export default function EliminarSuspensionModal({ suspension, onClose, onDeleted }: Props) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setMotivo(""), [suspension]);

  const submit = async () => {
    if (!suspension) return;
    if (!motivo.trim()) return toast.error("Escribe el motivo");
    setSaving(true);
    try {
      await eliminarSuspension(suspension.id, motivo.trim());
      toast.success("Registro eliminado y documentado en el log");
      onDeleted();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo eliminar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(suspension)}
      title="Eliminar seguimiento"
      subtitle={suspension?.clienteNombre}
      onClose={onClose}
      onSubmit={submit}
      busy={saving}
      submitLabel="Eliminar"
      submitDisabled={!motivo.trim()}
      submitClass="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-200 hover:bg-rose-700 disabled:opacity-60"
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Se borrará la suspensión con sus asignaciones y línea de tiempo. Antes de borrar, se guarda una copia completa
            en el <strong>log permanente</strong> (descargable en TXT). Los recordatorios pendientes de la agenda se cancelan.
          </p>
        </div>
        <div>
          <label className={labelCls} htmlFor="del-motivo">
            Motivo de la eliminación *
          </label>
          <textarea
            id="del-motivo"
            rows={3}
            className={inputCls}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
