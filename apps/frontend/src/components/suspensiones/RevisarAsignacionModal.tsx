import { CalendarPlus, ImageIcon, RefreshCcw, Repeat } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getApiOrigin } from "../../services/api";
import {
  errorMsg,
  fechaHora,
  RESULTADO_LABEL,
  revisarAsignacion,
  TIPO_ASIGNACION_LABEL,
  type AgendaInput,
  type Asignacion,
  type CambiarEstadoInput,
  type Suspension,
  type UsuarioRef,
} from "../../services/suspensiones";
import {
  AgendaForm,
  agendaInicial,
  AsignacionPaso1,
  AsignacionPaso2,
  asignacionInicial,
  EstadoForm,
  estadoInicial,
  payloadAgenda,
  payloadAsignacion,
  payloadEstado,
  validarEstado,
  type AsignacionDraft,
} from "./formularios";
import Modal, { inputCls, labelCls } from "./Modal";

type Props = {
  asignacion: Asignacion | null;
  suspension: Suspension | null;
  trabajadores: UsuarioRef[];
  responsables: UsuarioRef[];
  onClose: () => void;
  onSaved: () => void;
};

function Seccion({
  activa,
  onToggle,
  icon,
  titulo,
  children,
}: {
  activa: boolean;
  onToggle: (v: boolean) => void;
  icon: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border ${activa ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"} p-3`}>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={activa}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
        />
        {icon} {titulo}
      </label>
      {activa && <div className="mt-3">{children}</div>}
    </div>
  );
}

/**
 * El trabajador devolvió la asignación con su informe: aquí el admin/supervisor
 * lo lee, deja su nota y decide cómo continuar (estado, agenda, reasignar).
 */
export default function RevisarAsignacionModal({
  asignacion,
  suspension,
  trabajadores,
  responsables,
  onClose,
  onSaved,
}: Props) {
  const [nota, setNota] = useState("");
  const [conEstado, setConEstado] = useState(false);
  const [estado, setEstado] = useState<CambiarEstadoInput | null>(null);
  const [conAgenda, setConAgenda] = useState(false);
  const [agenda, setAgenda] = useState<AgendaInput>(agendaInicial());
  const [conReasignar, setConReasignar] = useState(false);
  const [reasignar, setReasignar] = useState<AsignacionDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNota("");
    setConEstado(false);
    setConAgenda(false);
    setConReasignar(false);
    setAgenda(agendaInicial());
    setEstado(suspension ? estadoInicial(suspension) : null);
    setReasignar(suspension && asignacion ? asignacionInicial(suspension, asignacion.tipo) : null);
  }, [asignacion, suspension]);

  const submit = async () => {
    if (!asignacion) return;
    if (!nota.trim()) return toast.error("Escribe la nota de revisión");
    if (conEstado && estado) {
      const e = validarEstado(estado);
      if (e) return toast.error(e);
    }
    if (conAgenda && !agenda.fecha) return toast.error("Indica la fecha del seguimiento");
    if (conReasignar && !reasignar?.trabajadorId) return toast.error("Selecciona el trabajador para reasignar");
    setSaving(true);
    try {
      await revisarAsignacion(asignacion.id, {
        revisionNota: nota.trim(),
        cambiarEstado: conEstado && estado ? payloadEstado(estado) : undefined,
        agenda: conAgenda ? payloadAgenda(agenda) : undefined,
        reasignar: conReasignar && reasignar ? payloadAsignacion(reasignar) : undefined,
      });
      toast.success("Asignación revisada y cerrada");
      onSaved();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo guardar la revisión"));
    } finally {
      setSaving(false);
    }
  };

  const devuelta = asignacion?.estado === "DEVUELTA";

  return (
    <Modal
      open={Boolean(asignacion && suspension)}
      title={devuelta ? "Revisar asignación devuelta" : "Cerrar asignación"}
      subtitle={
        asignacion && suspension
          ? `${TIPO_ASIGNACION_LABEL[asignacion.tipo]} · ${suspension.clienteNombre} · ${asignacion.trabajadorNombre ?? ""}`
          : undefined
      }
      onClose={onClose}
      onSubmit={submit}
      busy={saving}
      submitLabel="Guardar revisión y cerrar"
      size="lg"
    >
      {asignacion && suspension && (
        <div className="space-y-4">
          {devuelta ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Informe del trabajador</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {asignacion.resultado ? RESULTADO_LABEL[asignacion.resultado] : "—"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{asignacion.informeTrabajador}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>Entregada: {fechaHora(asignacion.devueltaEn)}</span>
                {asignacion.evidenciaUrl && (
                  <a
                    href={`${getApiOrigin()}${asignacion.evidenciaUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:underline"
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> Ver evidencia
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              El trabajador todavía no la entregó. Al cerrarla, su recordatorio en la agenda se cancela.
            </p>
          )}

          <div>
            <label className={labelCls} htmlFor="rev-nota">
              Nota de revisión *
            </label>
            <textarea
              id="rev-nota"
              rows={3}
              className={inputCls}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Qué se decide a partir del informe"
            />
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">¿Cómo continuar? (opcional)</p>

          <Seccion
            activa={conEstado}
            onToggle={setConEstado}
            icon={<RefreshCcw className="h-4 w-4 text-emerald-600" />}
            titulo="Cambiar el estado de la suspensión"
          >
            {estado && <EstadoForm value={estado} onChange={setEstado} />}
          </Seccion>

          <Seccion
            activa={conAgenda}
            onToggle={setConAgenda}
            icon={<CalendarPlus className="h-4 w-4 text-emerald-600" />}
            titulo="Agendar seguimiento"
          >
            <AgendaForm value={agenda} onChange={setAgenda} responsables={responsables} />
          </Seccion>

          <Seccion
            activa={conReasignar}
            onToggle={setConReasignar}
            icon={<Repeat className="h-4 w-4 text-emerald-600" />}
            titulo="Reasignar (nueva visita o recolección)"
          >
            {reasignar && (
              <div className="space-y-4">
                <AsignacionPaso1 value={reasignar} onChange={setReasignar} />
                <AsignacionPaso2 value={reasignar} onChange={setReasignar} trabajadores={trabajadores} />
              </div>
            )}
          </Seccion>
        </div>
      )}
    </Modal>
  );
}
