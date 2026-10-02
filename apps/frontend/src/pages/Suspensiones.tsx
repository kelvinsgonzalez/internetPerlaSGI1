import { motion } from "framer-motion";
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Inbox,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AgendaEntradaModal from "../components/suspensiones/AgendaEntradaModal";
import AsignarTrabajadorModal from "../components/suspensiones/AsignarTrabajadorModal";
import CambiarEstadoModal from "../components/suspensiones/CambiarEstadoModal";
import DetalleSuspensionDrawer from "../components/suspensiones/DetalleSuspensionDrawer";
import EliminarSuspensionModal from "../components/suspensiones/EliminarSuspensionModal";
import NuevaSuspensionModal from "../components/suspensiones/NuevaSuspensionModal";
import RevisarAsignacionModal from "../components/suspensiones/RevisarAsignacionModal";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import {
  descargarLogTxt,
  dinero,
  errorMsg,
  ESTADO_LABEL,
  ESTADO_STYLE,
  ESTADOS,
  fechaCorta,
  fechaHora,
  listarSuspensiones,
  porRevisar,
  RESULTADO_LABEL,
  TIPO_ASIGNACION_LABEL,
  usuariosSuspensiones,
  type Asignacion,
  type EstadoSuspension,
  type ListaSuspensiones,
  type Suspension,
  type UsuarioRef,
} from "../services/suspensiones";

const glassCard = "backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30";

type Vista = "activas" | "revisar" | "todas";
type Devuelta = Asignacion & { suspension: Suspension | null };

export default function Suspensiones() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const isAdmin = user?.role === "ADMIN";

  const [vista, setVista] = useState<Vista>("activas");
  const [estado, setEstado] = useState<EstadoSuspension | "">("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [lista, setLista] = useState<ListaSuspensiones | null>(null);
  const [devueltas, setDevueltas] = useState<Devuelta[]>([]);
  const [loading, setLoading] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [usuarios, setUsuarios] = useState<{ trabajadores: UsuarioRef[]; responsables: UsuarioRef[] }>({
    trabajadores: [],
    responsables: [],
  });

  // Diálogos
  const [nueva, setNueva] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [estadoDe, setEstadoDe] = useState<Suspension | null>(null);
  const [asignarA, setAsignarA] = useState<Suspension | null>(null);
  const [agendaDe, setAgendaDe] = useState<Suspension | null>(null);
  const [eliminarDe, setEliminarDe] = useState<Suspension | null>(null);
  const [revisar, setRevisar] = useState<{ a: Asignacion; s: Suspension } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [vista, estado, qDebounced]);

  useEffect(() => {
    usuariosSuspensiones()
      .then(setUsuarios)
      .catch(() => undefined);
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [l, d] = await Promise.all([
        listarSuspensiones({
          estado: estado || undefined,
          q: qDebounced || undefined,
          vista: vista === "activas" ? "activas" : undefined,
          page,
        }),
        porRevisar(),
      ]);
      setLista(l);
      setDevueltas(d);
    } catch (err) {
      toast.error(errorMsg(err, "No se pudieron cargar las suspensiones"));
    } finally {
      setLoading(false);
    }
  }, [estado, qDebounced, vista, page]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Algo cambió: recarga la lista y el panel abierto. */
  const refrescar = useCallback(() => {
    void cargar();
    setVersion((v) => v + 1);
  }, [cargar]);

  useEffect(() => {
    if (!socket) return;
    const onEvent = () => refrescar();
    const events = ["suspension:created", "suspension:updated", "suspension-asignacion:updated", "suspension-asignacion:devuelta"];
    events.forEach((e) => socket.on(e, onEvent));
    return () => events.forEach((e) => socket.off(e, onEvent));
  }, [socket, refrescar]);

  const descargar = async () => {
    setDescargando(true);
    try {
      await descargarLogTxt();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo descargar el log"));
    } finally {
      setDescargando(false);
    }
  };

  const contadores = lista?.contadores;
  const totalActivas = contadores
    ? contadores.SUSPENDIDO + contadores.REACTIVADO_ACUERDO + contadores.RECOGER_EQUIPO
    : 0;
  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.pageSize)) : 1;

  const tabs: { key: Vista; label: string; count?: number }[] = [
    { key: "activas", label: "Activas", count: totalActivas },
    { key: "revisar", label: "Por revisar", count: devueltas.length },
    { key: "todas", label: "Todas" },
  ];

  const estadosVisibles = vista === "activas" ? ESTADOS.filter((e) => e !== "DESCONEXION") : ESTADOS;

  return (
    <div className="relative min-h-full px-3 py-4 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="relative z-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              <Ban className="h-8 w-8 text-emerald-600" /> Suspensiones
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Clientes suspendidos o desconectados, su seguimiento y las visitas o recolecciones asignadas. Todo queda en el
              log permanente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button
                onClick={() => setNueva(true)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" /> Nueva suspensión
              </button>
            )}
            <Link
              to="/agenda"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
            >
              <CalendarDays className="h-4 w-4" /> Agenda
            </Link>
            <button
              onClick={descargar}
              disabled={descargando}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Log TXT
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" className="inline-flex w-fit rounded-full border border-emerald-200 bg-white p-1 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={vista === t.key}
                onClick={() => {
                  setVista(t.key);
                  setEstado("");
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  vista === t.key ? "bg-emerald-600 text-white shadow" : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={`rounded-full px-2 text-xs ${
                      vista === t.key
                        ? "bg-white/25"
                        : t.key === "revisar" && t.count > 0
                          ? "bg-violet-600 text-white"
                          : "bg-emerald-100"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          {vista !== "revisar" && (
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cliente, teléfono, IP…"
                className="w-full rounded-full border border-emerald-200/70 bg-white py-2 pl-10 pr-4 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
              />
            </div>
          )}
        </div>

        {vista !== "revisar" && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEstado("")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                estado === "" ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              Todos los estados
            </button>
            {estadosVisibles.map((e) => (
              <button
                key={e}
                onClick={() => setEstado(estado === e ? "" : e)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${ESTADO_STYLE[e]} ${
                  estado === e ? "ring-2 ring-offset-1 ring-emerald-400" : "opacity-80 hover:opacity-100"
                }`}
              >
                {ESTADO_LABEL[e]} · {contadores?.[e] ?? 0}
              </button>
            ))}
          </div>
        )}

        {loading && !lista && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}

        {vista === "revisar" ? (
          <section className="space-y-3">
            {!devueltas.length && (
              <div className={`${glassCard} flex flex-col items-center gap-2 rounded-3xl p-10 text-center text-slate-500`}>
                <Inbox className="h-8 w-8 text-emerald-400" />
                No hay asignaciones devueltas pendientes de revisión.
              </div>
            )}
            {devueltas.map((a) => (
              <motion.article
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glassCard} rounded-3xl p-5`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                      {TIPO_ASIGNACION_LABEL[a.tipo]} devuelta · {fechaHora(a.devueltaEn)}
                    </p>
                    <h3 className="text-lg font-bold text-slate-900">{a.suspension?.clienteNombre ?? "—"}</h3>
                    <p className="text-sm text-slate-500">Trabajador: {a.trabajadorNombre}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {a.resultado ? RESULTADO_LABEL[a.resultado] : ""}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{a.informeTrabajador}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {a.suspension && (
                      <>
                        <button
                          onClick={() => setDetalleId(a.suspensionId)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Ver seguimiento
                        </button>
                        <button
                          onClick={() => setRevisar({ a, s: a.suspension! })}
                          className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
                        >
                          <ClipboardCheck className="h-4 w-4" /> Revisar y decidir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </section>
        ) : (
          <>
            {lista && !lista.items.length && (
              <div className={`${glassCard} rounded-3xl p-10 text-center text-sm text-slate-500`}>
                No hay suspensiones con estos filtros.
              </div>
            )}
            {!!lista?.items.length && (
              <section className={`${glassCard} overflow-hidden rounded-3xl`}>
                <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_8rem_8rem_10rem] gap-4 border-b border-slate-100 bg-emerald-50/60 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                  <span>Nombre</span>
                  <span>Ubicación</span>
                  <span>Suspendido</span>
                  <span className="text-right">Debe</span>
                  <span className="text-right">Estado</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {lista.items.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setDetalleId(s.id)}
                        className="grid w-full grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 text-left text-sm transition hover:bg-emerald-50/70 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_8rem_8rem_10rem] md:items-center"
                      >
                        <span className="truncate font-semibold text-slate-900">{s.clienteNombre}</span>
                        <span className="col-span-2 row-start-2 truncate text-slate-600 md:col-span-1 md:row-start-auto">
                          {s.clienteDireccion || "—"}
                        </span>
                        <span className="row-start-3 text-slate-600 md:row-start-auto">
                          <span className="text-xs text-slate-400 md:hidden">Suspendido: </span>
                          {fechaCorta(s.fechaSuspension)}
                        </span>
                        <span className="row-start-3 text-right font-semibold text-slate-800 md:row-start-auto">
                          <span className="text-xs font-normal text-slate-400 md:hidden">Debe: </span>
                          {dinero(s.montoAdeudado)}
                        </span>
                        <span className="col-start-2 row-start-1 text-right md:col-start-auto md:row-start-auto">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_STYLE[s.estado]}`}>
                            {ESTADO_LABEL[s.estado]}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {lista && totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-3 text-sm">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-full border border-slate-200 bg-white p-2 disabled:opacity-40"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-slate-600">
                  Página {page} de {totalPaginas} · {lista.total} registros
                </span>
                <button
                  disabled={page >= totalPaginas}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border border-slate-200 bg-white p-2 disabled:opacity-40"
                  aria-label="Siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <DetalleSuspensionDrawer
        suspensionId={detalleId}
        version={version}
        isAdmin={isAdmin}
        onClose={() => setDetalleId(null)}
        onChanged={() => void cargar()}
        onCambiarEstado={setEstadoDe}
        onAsignar={setAsignarA}
        onAgenda={setAgendaDe}
        onRevisar={(a, s) => setRevisar({ a, s })}
        onEliminar={setEliminarDe}
      />

      <NuevaSuspensionModal
        open={nueva}
        onClose={() => setNueva(false)}
        onCreated={(s) => {
          setNueva(false);
          refrescar();
          setDetalleId(s.id);
        }}
      />
      <CambiarEstadoModal
        suspension={estadoDe}
        onClose={() => setEstadoDe(null)}
        onSaved={() => {
          setEstadoDe(null);
          refrescar();
        }}
      />
      <AsignarTrabajadorModal
        suspension={asignarA}
        trabajadores={usuarios.trabajadores}
        onClose={() => setAsignarA(null)}
        onSaved={() => {
          setAsignarA(null);
          refrescar();
        }}
      />
      <AgendaEntradaModal
        open={Boolean(agendaDe)}
        suspensionId={agendaDe?.id}
        clienteNombre={agendaDe?.clienteNombre}
        responsables={usuarios.responsables}
        onClose={() => setAgendaDe(null)}
        onSaved={() => {
          setAgendaDe(null);
          refrescar();
        }}
      />
      <RevisarAsignacionModal
        asignacion={revisar?.a ?? null}
        suspension={revisar?.s ?? null}
        trabajadores={usuarios.trabajadores}
        responsables={usuarios.responsables}
        onClose={() => setRevisar(null)}
        onSaved={() => {
          setRevisar(null);
          refrescar();
        }}
      />
      {isAdmin && (
        <EliminarSuspensionModal
          suspension={eliminarDe}
          onClose={() => setEliminarDe(null)}
          onDeleted={() => {
            setEliminarDe(null);
            setDetalleId(null);
            refrescar();
          }}
        />
      )}
    </div>
  );
}
