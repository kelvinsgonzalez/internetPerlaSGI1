import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  cambiarEstado,
  errorMsg,
  type CambiarEstadoInput,
  type EstadoSuspension,
  type Suspension,
} from "../../services/suspensiones";
import { EstadoForm, estadoInicial, payloadEstado, validarEstado } from "./formularios";
import Modal from "./Modal";

type Props = {
  suspension: Suspension | null;
  estadoSugerido?: EstadoSuspension;
  onClose: () => void;
  onSaved: () => void;
};

export default function CambiarEstadoModal({ suspension, estadoSugerido, onClose, onSaved }: Props) {
  const [value, setValue] = useState<CambiarEstadoInput | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(suspension ? estadoInicial(suspension, estadoSugerido) : null);
  }, [suspension, estadoSugerido]);

  const submit = async () => {
    if (!suspension || !value) return;
    const error = validarEstado(value);
    if (error) return toast.error(error);
    setSaving(true);
    try {
      await cambiarEstado(suspension.id, payloadEstado(value));
      toast.success("Estado actualizado");
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo cambiar el estado"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(suspension && value)}
      title="Cambiar estado"
      subtitle={suspension?.clienteNombre}
      onClose={onClose}
      onSubmit={submit}
      busy={saving}
    >
      {value && <EstadoForm value={value} onChange={setValue} disabled={saving} />}
    </Modal>
  );
}
