import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarPlus,
  Check,
  ClipboardCheck,
  ImageIcon,
  Loader2,
  MapPin,
  RefreshCcw,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getApiOrigin } from "../../services/api";
import {
  dinero,
  eliminarAgenda,
  errorMsg,
  ESTADO_ASIGNACION_LABEL,
  ESTADO_ASIGNACION_STYLE,
  ESTADO_LABEL,
  ESTADO_STYLE,
  fechaCorta,
  fechaHora,
  obtenerSuspension,
  RESULTADO_LABEL,
  resolverAgenda,
  TIPO_AGENDA_LABEL,
  TIPO_AGENDA_STYLE,
  TIPO_ASIGNACION_LABEL,
  type Asignacion,
  type Suspension,
  type SuspensionDetalle,
} from "../../services/suspensiones";
import { btnPrimary, btnSecondary } from "./Modal";

type Props = {
  suspensionId: string | null;
  /** Cambia cuando algo se guardó fuera del panel: fuerza recarga. */
  version: number;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
  onCambiarEstado: (s: Suspension) => void;
  onAsignar: (s: Suspension) => void;
  onAgenda: (s: Suspension) => void;
  onRevisar: (a: Asignacion, s: Suspension) => void;
  onEliminar: (s: Suspension) => void;
};

const EVENTO_LABEL: Record<string, string> = {
  CREACION: "Suspensión creada",
  CAMBIO_ESTADO: "Cambio de estado",
  EDICION: "Datos editados",
  ASIGNACION_CREADA: "Asignación creada",
  ASIGNACION_INICIADA: "Asignación iniciada",
  ASIGNACION_DEVUELTA: "Asignación devuelta por el trabajador",
  ASIGNACION_CERRADA: "Asignación revisada",
  AGENDA_CREADA: "Agenda",
  AGENDA_EDITADA: "Agenda editada",
  AGENDA_RESUELTA: "Agenda resuelta",
  AGENDA_ELIMINADA: "Recordatorio eliminado",
};

function Bloque({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800">{titulo}</h4>
        {accion}
      </div>
      {children}
    </section>
  );
}

const Dato = ({ label, value }: { label: string; value?: ReactNode }) => (
  <div>
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="text-sm text-slate-800">{value || "—"}</dd>
  </div>
);

export default function DetalleSuspensionDrawer({
  suspensionId,
  version,
  isAdmin,
  onClose,
  onChanged,
  onCambiarEstado,
  onAsignar,
  onAgenda,
  onRevisar,
  onEliminar,
}: Props) {
  const [data, setData] = useState<SuspensionDetalle | null>(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!suspensionId) return;
    setLoading(true);
    try {
      setData(await obtenerSuspension(suspensionId));
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo cargar la suspensión"));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [suspensionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setData(null);
  }, [suspensionId]);

  useEffect(() => {
    void cargar();
  }, [cargar, version]);

  const marcarAgenda = async (id: string) => {
    try {
      await resolverAgenda(id, "HECHO");
      await cargar();
      onChanged();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo actualizar la agenda"));
    }
  };

  const borrarAgenda = async (id: string, titulo: string) => {
    const motivo = window.prompt(`¿Eliminar "${titulo}"?\nQuedará documentado en el log. Motivo (opcional):`, "");
    if (motivo === null) return;
    try {
      await eliminarAgenda(id, motivo.trim() || undefined);
      toast.success("Recordatorio eliminado");
      await cargar();
      onChanged();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo eliminar"));
    }
  };

  const mapa =
    data?.clienteLatitud && data?.clienteLongitud
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${data.clienteLatitud},${data.clienteLongitud}`)}`
      : null;

  return (
    <AnimatePresence>
      {suspensionId && (
        <>
          <motion.div
            key="detalle-overlay"
            className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="detalle-panel"
            role="dialog"
            aria-modal="true"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-slate-50 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seguimiento de suspensión</p>
                <h3 className="truncate text-xl font-bold text-slate-900">{data?.clienteNombre ?? "Cargando…"}</h3>
                {data && (
                  <span
                    className={`mt-1 inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${ESTADO_STYLE[data.estado]}`}
                  >
                    {ESTADO_LABEL[data.estado]}
                  </span>
                )}
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </header>

            {data && (
              <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-5 py-3">
                <button className={btnPrimary} onClick={() => onCambiarEstado(data)}>
                  <RefreshCcw className="h-4 w-4" /> Cambiar estado
                </button>
                <button className={btnSecondary} onClick={() => onAsignar(data)}>
                  <UserPlus className="h-4 w-4" /> Asignar a trabajador
                </button>
                <button className={btnSecondary} onClick={() => onAgenda(data)}>
                  <CalendarPlus className="h-4 w-4" /> Agregar a la agenda
                </button>
                {isAdmin && (
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                    onClick={() => onEliminar(data)}
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {loading && !data && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </p>
              )}
              {data && (
                <>
                  <Bloque titulo="Cliente (copia)">
                    <dl className="grid grid-cols-2 gap-3">
                      <Dato label="Teléfono" value={data.clienteTelefono} />
                      <Dato label="IP" value={data.clienteIp} />
                      <Dato label="Plan" value={data.clientePlan} />
                      <Dato label="Fecha de suspensión" value={fechaCorta(data.fechaSuspension)} />
                      <Dato label="Monto adeudado" value={<strong>{dinero(data.montoAdeudado)}</strong>} />
                      <Dato label="Registrado por" value={`${data.creadoPorNombre ?? "—"} · ${fechaHora(data.createdAt)}`} />
                      <Dato
                        label="Dirección"
                        value={
                          <span>
                            {data.clienteDireccion || "—"}
                            {mapa && (
                              <a
                                href={mapa}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                              >
                                <MapPin className="h-3 w-3" /> Mapa
                              </a>
                            )}
                          </span>
                        }
                      />
                    </dl>
                  </Bloque>

                  {(data.acuerdoTexto || data.desconexionNota || data.recogerNota || data.recogerFecha) && (
                    <Bloque titulo="Detalle del estado">
                      <div className="space-y-3 text-sm">
                        {data.acuerdoTexto && (
                          <div>
                            <p className="font-semibold text-emerald-800">Acuerdo</p>
                            <p className="whitespace-pre-wrap text-slate-700">{data.acuerdoTexto}</p>
                            {!!data.acuerdoFechas?.length && (
                              <ul className="mt-1 space-y-0.5 text-slate-600">
                                {data.acuerdoFechas.map((f, i) => (
                                  <li key={i}>
                                    • {fechaCorta(f.fecha)}
                                    {f.monto != null && ` — ${dinero(f.monto)}`}
                                    {f.nota && ` (${f.nota})`}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {(data.recogerNota || data.recogerFecha) && (
                          <div>
                            <p className="font-semibold text-sky-800">Recolección de equipo</p>
                            {data.recogerFecha && <p className="text-slate-600">Planificada: {fechaCorta(data.recogerFecha)}</p>}
                            {data.recogerNota && <p className="whitespace-pre-wrap text-slate-700">{data.recogerNota}</p>}
                          </div>
                        )}
                        {data.desconexionNota && (
                          <div>
                            <p className="font-semibold text-rose-800">Desconexión</p>
                            <p className="whitespace-pre-wrap text-slate-700">{data.desconexionNota}</p>
                            <p className="text-slate-600">
                              Quedó debiendo: <strong>{dinero(data.montoPendienteFinal)}</strong>
                            </p>
                          </div>
                        )}
                      </div>
                    </Bloque>
                  )}

                  <Bloque titulo={`Asignaciones (${data.asignaciones.length})`}>
                    {!data.asignaciones.length && <p className="text-sm text-slate-400">Sin asignaciones.</p>}
                    <ul className="space-y-3">
                      {data.asignaciones.map((a) => (
                        <li key={a.id} className="rounded-xl border border-slate-100 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">
                              {TIPO_ASIGNACION_LABEL[a.tipo]} · {a.trabajadorNombre}
                            </p>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_ASIGNACION_STYLE[a.estado]}`}>
                              {ESTADO_ASIGNACION_LABEL[a.estado]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Asignada {fechaHora(a.createdAt)} por {a.asignadoPorNombre ?? "—"}
                            {a.fechaProgramada && ` · programada ${fechaCorta(a.fechaProgramada)}`}
                          </p>
                          {a.instrucciones && <p className="mt-1 text-sm text-slate-600">{a.instrucciones}</p>}
                          {a.informeTrabajador && (
                            <div className="mt-2 rounded-lg bg-violet-50 p-2 text-sm">
                              <p className="font-semibold text-violet-800">
                                {a.resultado ? RESULTADO_LABEL[a.resultado] : "Informe"}
                              </p>
                              <p className="whitespace-pre-wrap text-slate-700">{a.informeTrabajador}</p>
                              {a.evidenciaUrl && (
                                <a
                                  href={`${getApiOrigin()}${a.evidenciaUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"
                                >
                                  <ImageIcon className="h-3.5 w-3.5" /> Evidencia
                                </a>
                              )}
                            </div>
                          )}
                          {a.revisionNota && (
                            <p className="mt-2 text-xs text-slate-500">
                              Revisión de {a.revisadoPorNombre}: {a.revisionNota}
                            </p>
                          )}
                          {a.estado !== "CERRADA" && (
                            <button
                              onClick={() => onRevisar(a, data)}
                              className={`mt-2 ${a.estado === "DEVUELTA" ? btnPrimary : btnSecondary} !px-3 !py-1 text-xs`}
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              {a.estado === "DEVUELTA" ? "Revisar y decidir" : "Cerrar asignación"}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Bloque>

                  <Bloque titulo={`Agenda (${data.agenda.length})`}>
                    {!data.agenda.length && <p className="text-sm text-slate-400">Sin recordatorios.</p>}
                    <ul className="divide-y divide-slate-100">
                      {data.agenda.map((e) => (
                        <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold ${e.estado === "PENDIENTE" ? "text-slate-800" : "text-slate-400 line-through"}`}
                            >
                              {e.titulo}
                            </p>
                            <p className="text-xs text-slate-500">
                              {fechaCorta(e.fecha)}
                              {e.hora && ` ${e.hora}`} ·{" "}
                              <span className={`rounded px-1.5 ${TIPO_AGENDA_STYLE[e.tipo]}`}>{TIPO_AGENDA_LABEL[e.tipo]}</span>
                              {e.estado !== "PENDIENTE" && ` · ${e.estado.toLowerCase()}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {e.estado === "PENDIENTE" && (
                              <button
                                onClick={() => marcarAgenda(e.id)}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                <Check className="h-3.5 w-3.5" /> Hecho
                              </button>
                            )}
                            <button
                              onClick={() => borrarAgenda(e.id, e.titulo)}
                              className="rounded-full border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                              aria-label="Eliminar recordatorio"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Bloque>

                  <Bloque titulo="Línea de tiempo">
                    <ol className="relative space-y-4 border-l-2 border-emerald-100 pl-4">
                      {data.eventos.map((ev) => (
                        <li key={ev.id} className="relative">
                          <span className="absolute -left-[1.4rem] top-1 flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          <p className="text-sm font-semibold text-slate-800">
                            {EVENTO_LABEL[ev.tipo] ?? ev.tipo}
                            {ev.estadoNuevo && ev.tipo === "CAMBIO_ESTADO" && (
                              <span className="font-normal text-slate-500">
                                {" "}
                                {ev.estadoAnterior ? `${ESTADO_LABEL[ev.estadoAnterior as keyof typeof ESTADO_LABEL] ?? ev.estadoAnterior} → ` : ""}
                                {ESTADO_LABEL[ev.estadoNuevo as keyof typeof ESTADO_LABEL] ?? ev.estadoNuevo}
                              </span>
                            )}
                          </p>
                          {ev.nota && ev.tipo !== "CREACION" && (
                            <p className="whitespace-pre-wrap text-sm text-slate-600">{ev.nota}</p>
                          )}
                          <p className="text-xs text-slate-400">
                            <CalendarCheck className="mr-1 inline h-3 w-3" />
                            {fechaHora(ev.createdAt)} · {ev.usuarioNombre ?? "—"}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </Bloque>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
