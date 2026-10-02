import { motion } from "framer-motion";
import { Camera, CheckCircle2, Loader2, MapPin, Phone, PlayCircle, Truck, Wifi } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Modal, { inputCls, labelCls } from "../components/suspensiones/Modal";
import { useSocket } from "../hooks/useSocket";
import {
  completarAsignacion,
  dinero,
  errorMsg,
  ESTADO_ASIGNACION_LABEL,
  ESTADO_ASIGNACION_STYLE,
  fechaCorta,
  fechaHora,
  iniciarAsignacion,
  misAsignaciones,
  RESULTADO_LABEL,
  TIPO_ASIGNACION_LABEL,
  type MiAsignacion,
  type ResultadoAsignacion,
} from "../services/suspensiones";

const glassCard = "backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30";

/**
 * Vista del trabajador: sus visitas y recolecciones de Suspensiones. Al
 * completar debe contar qué pasó; la asignación vuelve al admin para revisión.
 * (El trabajador no ve la agenda ni el resto del módulo.)
 */
export default function MisAsignacionesSuspension() {
  const { socket } = useSocket();
  const [data, setData] = useState<{ activas: MiAsignacion[]; recientes: MiAsignacion[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completar, setCompletar] = useState<MiAsignacion | null>(null);
  const [resultado, setResultado] = useState<ResultadoAsignacion | "">("");
  const [informe, setInforme] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setData(await misAsignaciones());
    } catch (err) {
      toast.error(errorMsg(err, "No se pudieron cargar tus asignaciones"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!socket) return;
    const onCreated = (p: { tipo?: string; cliente?: string }) => {
      toast.info(
        `Nueva ${p.tipo === "RECOGER_EQUIPO" ? "recolección de equipo" : "visita"}${p.cliente ? `: ${p.cliente}` : ""}`
      );
      void cargar();
    };
    const onUpdated = () => void cargar();
    socket.on("suspension-asignacion:created", onCreated);
    socket.on("suspension-asignacion:updated", onUpdated);
    return () => {
      socket.off("suspension-asignacion:created", onCreated);
      socket.off("suspension-asignacion:updated", onUpdated);
    };
  }, [socket, cargar]);

  const iniciar = async (a: MiAsignacion) => {
    setBusyId(a.id);
    try {
      await iniciarAsignacion(a.id);
      await cargar();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo iniciar"));
    } finally {
      setBusyId(null);
    }
  };

  const abrirCompletar = (a: MiAsignacion) => {
    setCompletar(a);
    setResultado(a.tipo === "RECOGER_EQUIPO" ? "EQUIPO_RECOGIDO" : "");
    setInforme("");
    setFoto(null);
  };

  const enviar = async () => {
    if (!completar) return;
    if (!resultado) return toast.error("Selecciona el resultado");
    if (!informe.trim()) return toast.error("Escribe qué fue lo que pasó");
    setEnviando(true);
    try {
      await completarAsignacion(completar.id, { resultado, informe: informe.trim(), evidencia: foto });
      toast.success("Entregado. El administrador revisará tu informe.");
      setCompletar(null);
      await cargar();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo entregar"));
    } finally {
      setEnviando(false);
    }
  };

  const Tarjeta = ({ a, activa }: { a: MiAsignacion; activa: boolean }) => {
    const mapa =
      a.cliente?.latitud && a.cliente?.longitud
        ? `https://www.google.com/maps?q=${encodeURIComponent(`${a.cliente.latitud},${a.cliente.longitud}`)}`
        : a.cliente?.direccion
          ? `https://www.google.com/maps/search/${encodeURIComponent(a.cliente.direccion)}`
          : null;
    return (
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${glassCard} flex flex-col gap-3 rounded-3xl p-5 ${activa ? "" : "opacity-80"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              {a.tipo === "RECOGER_EQUIPO" ? <Truck className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{TIPO_ASIGNACION_LABEL[a.tipo]}</p>
              <h3 className="text-lg font-bold text-slate-900">{a.cliente?.nombre ?? "—"}</h3>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_ASIGNACION_STYLE[a.estado]}`}>
            {a.estado === "DEVUELTA" ? "Entregada" : ESTADO_ASIGNACION_LABEL[a.estado]}
          </span>
        </div>

        <dl className="grid gap-1.5 text-sm text-slate-700">
          {a.cliente?.direccion && (
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                {a.cliente.direccion}
                {mapa && (
                  <a href={mapa} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-emerald-700 hover:underline">
                    Abrir mapa
                  </a>
                )}
              </span>
            </div>
          )}
          {(a.telefonoContacto || a.cliente?.telefono) && (
            <div className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <a href={`tel:${a.telefonoContacto || a.cliente?.telefono}`} className="text-emerald-700 hover:underline">
                {a.telefonoContacto || a.cliente?.telefono}
              </a>
            </div>
          )}
          {(a.cliente?.ip || a.cliente?.plan) && (
            <div className="flex gap-2">
              <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>{[a.cliente?.ip && `IP ${a.cliente.ip}`, a.cliente?.plan].filter(Boolean).join(" · ")}</span>
            </div>
          )}
        </dl>

        {a.instrucciones && (
          <p className="whitespace-pre-wrap rounded-xl bg-amber-50/70 p-3 text-sm text-slate-800">{a.instrucciones}</p>
        )}

        <p className="text-xs text-slate-500">
          {a.fechaProgramada && (
            <>
              Programada: <strong>{fechaCorta(a.fechaProgramada)}</strong> ·{" "}
            </>
          )}
          Saldo pendiente: <strong>{dinero(a.montoAdeudado)}</strong> · Asignada por {a.asignadoPorNombre ?? "—"}
        </p>

        {!activa && a.informeTrabajador && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-700">{a.resultado ? RESULTADO_LABEL[a.resultado] : "Tu informe"}</p>
            <p className="whitespace-pre-wrap text-slate-600">{a.informeTrabajador}</p>
            <p className="mt-1 text-xs text-slate-400">Entregada {fechaHora(a.devueltaEn)}</p>
          </div>
        )}

        {activa && (
          <div className="flex flex-wrap gap-2">
            {a.estado === "PENDIENTE" && (
              <button
                onClick={() => iniciar(a)}
                disabled={busyId === a.id}
                className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
              >
                {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Iniciar
              </button>
            )}
            <button
              onClick={() => abrirCompletar(a)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" /> Completar
            </button>
          </div>
        )}
      </motion.article>
    );
  };

  return (
    <div className="relative min-h-screen px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_55%)]" />
      <div className="relative z-10 space-y-6">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Visitas y recolecciones</h1>
          <p className="mt-2 text-sm text-slate-600">
            Asignaciones de clientes suspendidos. Al terminar, cuenta qué pasó: tu informe regresa al administrador.
          </p>
        </header>

        {loading && !data && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}

        {data && (
          <>
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Pendientes ({data.activas.length})
              </h2>
              {!data.activas.length ? (
                <div className={`${glassCard} rounded-3xl p-8 text-center text-sm text-slate-500`}>
                  No tienes visitas ni recolecciones pendientes.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {data.activas.map((a) => (
                    <Tarjeta key={a.id} a={a} activa />
                  ))}
                </div>
              )}
            </section>
            {!!data.recientes.length && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Entregadas recientemente</h2>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {data.recientes.map((a) => (
                    <Tarjeta key={a.id} a={a} activa={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Modal
        open={Boolean(completar)}
        title="Completar"
        subtitle={completar ? `${TIPO_ASIGNACION_LABEL[completar.tipo]} · ${completar.cliente?.nombre ?? ""}` : undefined}
        onClose={() => setCompletar(null)}
        onSubmit={enviar}
        busy={enviando}
        submitLabel="Entregar al administrador"
        submitDisabled={!informe.trim() || !resultado}
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="comp-resultado">
              Resultado *
            </label>
            <select
              id="comp-resultado"
              className={inputCls}
              value={resultado}
              onChange={(e) => setResultado(e.target.value as ResultadoAsignacion)}
            >
              <option value="">Selecciona…</option>
              {(Object.keys(RESULTADO_LABEL) as ResultadoAsignacion[]).map((r) => (
                <option key={r} value={r}>
                  {RESULTADO_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="comp-informe">
              ¿Qué pasó? *
            </label>
            <textarea
              id="comp-informe"
              rows={5}
              className={inputCls}
              value={informe}
              onChange={(e) => setInforme(e.target.value)}
              placeholder="Describe lo que ocurrió: qué equipo recogiste, qué dijo el cliente, si pagó o propuso algo, etc."
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="comp-foto">
              Foto de evidencia (opcional)
            </label>
            <label
              htmlFor="comp-foto"
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 px-4 py-3 text-sm text-emerald-800 hover:bg-emerald-50"
            >
              <Camera className="h-4 w-4" /> {foto ? foto.name : "Tomar o elegir foto"}
            </label>
            <input
              id="comp-foto"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
