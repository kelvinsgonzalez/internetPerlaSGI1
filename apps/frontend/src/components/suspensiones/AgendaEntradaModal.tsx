import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  crearAgenda,
  editarAgenda,
  errorMsg,
  type AgendaEntrada,
  type AgendaInput,
  type UsuarioRef,
} from "../../services/suspensiones";
import { AgendaForm, agendaInicial, payloadAgenda } from "./formularios";
import Modal from "./Modal";

type Props = {
  open: boolean;
  /** Entrada a editar; null = alta. */
  entrada?: AgendaEntrada | null;
  /** Alta ligada a una suspensión. */
  suspensionId?: string;
  clienteNombre?: string;
  responsables: UsuarioRef[];
  onClose: () => void;
  onSaved: () => void;
};

export default function AgendaEntradaModal({
  open,
  entrada,
  suspensionId,
  clienteNombre,
  responsables,
  onClose,
  onSaved,
}: Props) {
  const [value, setValue] = useState<AgendaInput>(agendaInicial());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(
      entrada
        ? {
            fecha: entrada.fecha,
            hora: entrada.hora ?? "",
            tipo: entrada.tipo,
            titulo: entrada.titulo,
            nota: entrada.nota ?? "",
            responsableId: entrada.responsableId ?? "",
          }
        : agendaInicial()
    );
  }, [open, entrada]);

  const submit = async () => {
    if (!value.fecha) return toast.error("Indica la fecha");
    setSaving(true);
    try {
      if (entrada) {
        await editarAgenda(entrada.id, {
          ...payloadAgenda(value),
          // En edición, vacío significa "quitar".
          hora: value.hora ?? "",
          nota: value.nota ?? "",
          responsableId: value.responsableId ?? "",
        });
      } else {
        await crearAgenda({ ...payloadAgenda(value), suspensionId });
      }
      toast.success(entrada ? "Agenda actualizada" : "Agregado a la agenda");
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo guardar en la agenda"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={entrada ? "Editar recordatorio" : "Agregar a la agenda"}
      subtitle={entrada?.clienteNombre ?? clienteNombre}
      onClose={onClose}
      onSubmit={submit}
      busy={saving}
    >
      <AgendaForm value={value} onChange={setValue} responsables={responsables} />
    </Modal>
  );
}
