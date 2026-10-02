import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AgendaEntradaModal from "../components/suspensiones/AgendaEntradaModal";
import { useSocket } from "../hooks/useSocket";
import {
  descargarIcs,
  eliminarAgenda,
  errorMsg,
  fechaCorta,
  hoyISO,
  listarAgenda,
  resolverAgenda,
  resumenAgenda,
  TIPO_AGENDA_LABEL,
  TIPO_AGENDA_STYLE,
  usuariosSuspensiones,
  type AgendaEntrada,
  type EstadoAgenda,
  type TipoAgenda,
  type UsuarioRef,
} from "../services/suspensiones";

const glassCard = "backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30";

type Vista = "vencidos" | "hoy" | "proximos" | "todos" | "calendario";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Agenda de recordatorios de Suspensiones. Sólo ADMIN y SUPERVISOR. */
export default function AgendaSuspensiones() {
  const { socket } = useSocket();
  const [vista, setVista] = useState<Vista>("hoy");
  const [tipo, setTipo] = useState<TipoAgenda | "">("");
  const [responsableId, setResponsableId] = useState("");
  const [verResueltos, setVerResueltos] = useState(false);
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [items, setItems] = useState<AgendaEntrada[]>([]);
  const [resumen, setResumen] = useState<{ hoy: number; vencidos: number } | null>(null);
  const [responsables, setResponsables] = useState<UsuarioRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ entrada: AgendaEntrada | null } | null>(null);
  const [diaSel, setDiaSel] = useState<string | null>(null);

  useEffect(() => {
    usuariosSuspensiones()
      .then((u) => setResponsables(u.responsables))
      .catch(() => undefined);
  }, []);

  const rango = useMemo(() => {
    const hoy = hoyISO();
    switch (vista) {
      case "vencidos":
        return { hasta: hoyISO(-1), estado: "PENDIENTE" };
      case "hoy":
        return { desde: hoy, hasta: hoy };
      case "proximos":
        return { desde: hoyISO(1), hasta: hoyISO(7) };
      case "todos":
        return {};
      case "calendario": {
        const fin = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
        return { desde: iso(mes), hasta: iso(fin) };
      }
    }
  }, [vista, mes]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const estado =
        (rango as { estado?: string }).estado ??
        (verResueltos || vista === "calendario" || vista === "hoy" ? undefined : "PENDIENTE");
      const [lista, r] = await Promise.all([
        listarAgenda({ ...rango, estado, tipo: tipo || undefined, responsableId: responsableId || undefined }),
        resumenAgenda(),
      ]);
      setItems(lista);
      setResumen(r);
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo cargar la agenda"));
    } finally {
      setLoading(false);
    }
  }, [rango, tipo, responsableId, verResueltos, vista]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!socket) return;
    const onEvent = () => void cargar();
    const events = ["agenda:updated", "agenda:recordatorio", "suspension:updated"];
    events.forEach((e) => socket.on(e, onEvent));
    return () => events.forEach((e) => socket.off(e, onEvent));
  }, [socket, cargar]);

  const resolver = async (e: AgendaEntrada, estado: EstadoAgenda) => {
    let nota: string | undefined;
    if (estado === "CANCELADO") {
      const r = window.prompt("Motivo de la cancelación (opcional):", "");
      if (r === null) return;
      nota = r;
    }
    try {
      await resolverAgenda(e.id, estado, nota);
      toast.success(estado === "HECHO" ? "Marcado como hecho" : estado === "CANCELADO" ? "Cancelado" : "Reabierto");
      void cargar();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo actualizar"));
    }
  };

  const eliminar = async (e: AgendaEntrada) => {
    const motivo = window.prompt(
      `¿Eliminar "${e.titulo}" (${fechaCorta(e.fecha)})?\nQuedará documentado en el log. Motivo (opcional):`,
      ""
    );
    if (motivo === null) return;
    try {
      await eliminarAgenda(e.id, motivo.trim() || undefined);
      toast.success("Recordatorio eliminado");
      void cargar();
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo eliminar"));
    }
  };

  const exportar = async () => {
    try {
      await descargarIcs(vista === "calendario" ? { desde: rango.desde, hasta: rango.hasta } : undefined);
      toast.success("Archivo .ics descargado: ábrelo para importarlo en tu calendario");
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo exportar"));
    }
  };

  const tabs: { key: Vista; label: string; badge?: number; alerta?: boolean }[] = [
    { key: "vencidos", label: "Vencidos", badge: resumen?.vencidos, alerta: true },
    { key: "hoy", label: "Hoy", badge: resumen?.hoy },
    { key: "proximos", label: "Próximos 7 días" },
    { key: "todos", label: "Todos" },
    { key: "calendario", label: "Calendario" },
  ];

  const hoy = hoyISO();

  const Fila = ({ e }: { e: AgendaEntrada }) => {
    const vencido = e.estado === "PENDIENTE" && e.fecha < hoy;
    return (
      <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TIPO_AGENDA_STYLE[e.tipo]}`}>
              {TIPO_AGENDA_LABEL[e.tipo]}
            </span>
            <span className={`text-xs font-semibold ${vencido ? "text-rose-600" : "text-slate-500"}`}>
              {fechaCorta(e.fecha)}
              {e.hora && ` · ${e.hora}`}
              {vencido && " · vencido"}
            </span>
            {e.estado !== "PENDIENTE" && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {e.estado === "HECHO" ? "Hecho" : "Cancelado"}
              </span>
            )}
          </div>
          <p
            className={`mt-1 font-semibold ${e.estado === "PENDIENTE" ? "text-slate-900" : "text-slate-400 line-through"}`}
          >
            {e.titulo}
          </p>
          {e.nota && <p className="whitespace-pre-wrap text-sm text-slate-600">{e.nota}</p>}
          <p className="text-xs text-slate-400">
            Responsable: {e.responsableNombre ?? "Admin y supervisor"}
            {e.resolucionNota && ` · ${e.resolucionNota}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {e.estado === "PENDIENTE" ? (
            <>
              <button
                onClick={() => resolver(e, "HECHO")}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Check className="h-3.5 w-3.5" /> Hecho
              </button>
              <button
                onClick={() => setModal({ entrada: e })}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <button
                onClick={() => resolver(e, "CANCELADO")}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => resolver(e, "PENDIENTE")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reabrir
            </button>
          )}
          <button
            onClick={() => eliminar(e)}
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            aria-label="Eliminar recordatorio"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    );
  };

  // ---- calendario mensual
  const celdas = useMemo(() => {
    if (vista !== "calendario") return [];
    const offset = (mes.getDay() + 6) % 7; // lunes primero
    const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= dias; d++) out.push(iso(new Date(mes.getFullYear(), mes.getMonth(), d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [vista, mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, AgendaEntrada[]>();
    for (const e of items) m.set(e.fecha, [...(m.get(e.fecha) ?? []), e]);
    return m;
  }, [items]);

  const listaVisible = vista === "calendario" ? (diaSel ? porDia.get(diaSel) ?? [] : []) : items;

  return (
    <div className="relative min-h-full px-3 py-4 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="relative z-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              <CalendarDays className="h-8 w-8 text-emerald-600" /> Agenda de trabajo
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Recordatorios de cobros de acuerdos, visitas, recolecciones y seguimientos de{" "}
              <Link to="/suspensiones" className="font-semibold text-emerald-700 hover:underline">
                Suspensiones
              </Link>
              . Cada mañana a las 07:00 llega un aviso con lo de hoy y lo vencido.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModal({ entrada: null })}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" /> Agregar
            </button>
            <button
              onClick={exportar}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              title="Descarga un .ics para Google Calendar, Outlook o el celular"
            >
              <Download className="h-4 w-4" /> Exportar a calendario (.ics)
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div role="tablist" className="inline-flex w-fit flex-wrap rounded-3xl border border-emerald-200 bg-white p-1 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={vista === t.key}
                onClick={() => {
                  setVista(t.key);
                  setDiaSel(null);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  vista === t.key ? "bg-emerald-600 text-white shadow" : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {t.label}
                {!!t.badge && (
                  <span
                    className={`rounded-full px-2 text-xs ${
                      vista === t.key ? "bg-white/25" : t.alerta ? "bg-rose-500 text-white" : "bg-emerald-100"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAgenda | "")}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">Todos los tipos</option>
              {(Object.keys(TIPO_AGENDA_LABEL) as TipoAgenda[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_AGENDA_LABEL[t]}
                </option>
              ))}
            </select>
            <select
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">Cualquier responsable</option>
              <option value="sin">Admin y supervisor (sin asignar)</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            {(vista === "proximos" || vista === "todos") && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={verResueltos}
                  onChange={(e) => setVerResueltos(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                Ver hechos y cancelados
              </label>
            )}
          </div>
        </div>

        {vista === "calendario" && (
          <motion.section className={`${glassCard} rounded-3xl p-4`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
                className="rounded-full p-2 hover:bg-emerald-50"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-bold text-slate-800">
                {MESES[mes.getMonth()]} {mes.getFullYear()}
              </h2>
              <button
                onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
                className="rounded-full p-2 hover:bg-emerald-50"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
              {DIAS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {celdas.map((d, i) => {
                if (!d) return <div key={i} />;
                const lista = porDia.get(d) ?? [];
                const pendientes = lista.filter((e) => e.estado === "PENDIENTE");
                const vencido = d < hoy && pendientes.length > 0;
                return (
                  <button
                    key={d}
                    onClick={() => setDiaSel(diaSel === d ? null : d)}
                    className={`flex min-h-[4.5rem] flex-col items-start rounded-xl border p-1.5 text-left transition sm:min-h-[6rem] ${
                      diaSel === d
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                        : d === hoy
                          ? "border-emerald-300 bg-white"
                          : "border-slate-100 bg-white/70 hover:bg-emerald-50/50"
                    }`}
                  >
                    <span className={`text-xs font-bold ${d === hoy ? "text-emerald-700" : "text-slate-600"}`}>
                      {Number(d.slice(8))}
                    </span>
                    <div className="mt-1 hidden w-full space-y-0.5 sm:block">
                      {lista.slice(0, 3).map((e) => (
                        <p
                          key={e.id}
                          className={`truncate rounded px-1 text-[10px] font-semibold ${TIPO_AGENDA_STYLE[e.tipo]} ${
                            e.estado !== "PENDIENTE" ? "opacity-50 line-through" : ""
                          }`}
                        >
                          {e.hora ? `${e.hora} ` : ""}
                          {e.titulo}
                        </p>
                      ))}
                      {lista.length > 3 && <p className="text-[10px] text-slate-400">+{lista.length - 3} más</p>}
                    </div>
                    {!!lista.length && (
                      <span
                        className={`mt-auto rounded-full px-1.5 text-[10px] font-bold sm:hidden ${
                          vencido ? "bg-rose-500 text-white" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {lista.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {(vista !== "calendario" || diaSel) && (
          <section className={`${glassCard} rounded-3xl px-5 py-2`}>
            {vista === "calendario" && diaSel && (
              <h3 className="pt-3 text-sm font-bold text-slate-700">{fechaCorta(diaSel)}</h3>
            )}
            {loading && !items.length ? (
              <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </p>
            ) : !listaVisible.length ? (
              <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <AlertCircle className="h-4 w-4 text-emerald-400" />
                {vista === "vencidos" ? "No hay recordatorios vencidos." : "Nada agendado aquí."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {listaVisible.map((e) => (
                  <Fila key={e.id} e={e} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <AgendaEntradaModal
        open={Boolean(modal)}
        entrada={modal?.entrada ?? null}
        responsables={responsables}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          void cargar();
        }}
      />
    </div>
  );
}
