import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { asignar, errorMsg, TIPO_ASIGNACION_LABEL, type Suspension, type UsuarioRef } from "../../services/suspensiones";
import { AsignacionPaso1, AsignacionPaso2, asignacionInicial, payloadAsignacion, type AsignacionDraft } from "./formularios";
import Modal, { btnPrimary, btnSecondary } from "./Modal";

type Props = {
  suspension: Suspension | null;
  trabajadores: UsuarioRef[];
  onClose: () => void;
  onSaved: () => void;
};

/** Asistente de dos pasos: primero QUÉ hacer, después QUIÉN y cuándo. */
export default function AsignarTrabajadorModal({ suspension, trabajadores, onClose, onSaved }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [value, setValue] = useState<AsignacionDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPaso(1);
    setValue(
      suspension ? asignacionInicial(suspension, suspension.estado === "RECOGER_EQUIPO" ? "RECOGER_EQUIPO" : "VISITA") : null
    );
  }, [suspension]);

  const submit = async () => {
    if (!suspension || !value) return;
    if (paso === 1) return setPaso(2);
    if (!value.trabajadorId) return toast.error("Selecciona un trabajador");
    setSaving(true);
    try {
      await asignar(suspension.id, payloadAsignacion(value));
      toast.success("Asignación enviada al trabajador");
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo asignar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(suspension && value)}
      title={`Asignar a trabajador · Paso ${paso} de 2`}
      subtitle={
        paso === 1
          ? `${suspension?.clienteNombre ?? ""}: especifica qué se debe hacer`
          : `${value ? TIPO_ASIGNACION_LABEL[value.tipo] : ""} · ${suspension?.clienteNombre ?? ""}`
      }
      onClose={onClose}
      onSubmit={submit}
      busy={saving}
      footer={
        <>
          {paso === 2 ? (
            <button type="button" onClick={() => setPaso(1)} disabled={saving} className={btnSecondary}>
              <ArrowLeft className="h-4 w-4" /> Atrás
            </button>
          ) : (
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancelar
            </button>
          )}
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {paso === 1 ? (
              <>
                Siguiente <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              "Asignar"
            )}
          </button>
        </>
      }
    >
      {value &&
        (paso === 1 ? (
          <AsignacionPaso1 value={value} onChange={setValue} />
        ) : (
          <AsignacionPaso2 value={value} onChange={setValue} trabajadores={trabajadores} />
        ))}
    </Modal>
  );
}
