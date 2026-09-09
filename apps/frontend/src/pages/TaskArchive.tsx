import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getApiOrigin } from "../services/api";
import {
  downloadArchiveTxt,
  getArchiveOptions,
  listArchivedTasks,
  type ArchiveOptions,
  type ArchiveQuery,
  type ArchivedTask,
} from "../services/taskArchive";

type DateMode = "ninguno" | "dia" | "rango";

const glassCard =
  "backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30";

const fieldCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400";

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString();
};

export default function TaskArchive() {
  const [records, setRecords] = useState<ArchivedTask[]>([]);
  const [options, setOptions] = useState<ArchiveOptions>({
    clientes: [],
    trabajadores: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [dateMode, setDateMode] = useState<DateMode>("ninguno");
  const [dia, setDia] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [trabajadorId, setTrabajadorId] = useState("");

  // Los filtros de fecha van por dia de creacion de la tarea; "dia" es
  // simplemente un rango de un solo dia.
  const query = useMemo<ArchiveQuery>(() => {
    const q: ArchiveQuery = {};
    if (dateMode === "dia" && dia) {
      q.desde = dia;
      q.hasta = dia;
    } else if (dateMode === "rango") {
      if (desde) q.desde = desde;
      if (hasta) q.hasta = hasta;
    }
    if (clienteId) q.clienteId = clienteId;
    if (trabajadorId) q.trabajadorId = trabajadorId;
    return q;
  }, [dateMode, dia, desde, hasta, clienteId, trabajadorId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listArchivedTasks(query);
      setRecords(data);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "No se pudo leer el archivo de tareas."
      );
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  // Los selectores se arman con lo que hay en el archivo, no con la base de
  // datos: un cliente borrado tiene que seguir siendo filtrable.
  useEffect(() => {
    getArchiveOptions()
      .then(setOptions)
      .catch(() => setOptions({ clientes: [], trabajadores: [] }));
  }, [records.length]);

  const limpiar = () => {
    setDateMode("ninguno");
    setDia("");
    setDesde("");
    setHasta("");
    setClienteId("");
    setTrabajadorId("");
  };

  const onDescargar = async () => {
    try {
      await downloadArchiveTxt(query);
    } catch {
      toast.error("No se pudo descargar el archivo");
    }
  };

  const hayFiltros =
    dateMode !== "ninguno" || Boolean(clienteId) || Boolean(trabajadorId);

  return (
    <div className="relative min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Archivo de Tareas
            </motion.h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Registro permanente en texto plano de las tareas completadas que
              se archivaron. Vive fuera de la base de datos, así que no se
              pierde aunque la base se reinicie o se borre.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              Actualizar
            </button>
            <button
              onClick={onDescargar}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600"
            >
              Descargar .txt
            </button>
          </div>
        </header>

        <motion.section
          className={`${glassCard} rounded-3xl p-4 sm:p-5`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Fecha de creación
              </label>
              <select
                className={`${fieldCls} mt-1`}
                value={dateMode}
                onChange={(e) => setDateMode(e.target.value as DateMode)}
              >
                <option value="ninguno">Sin filtro de fecha</option>
                <option value="dia">Día específico</option>
                <option value="rango">Rango de fechas</option>
              </select>
            </div>

            {dateMode === "dia" && (
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Día
                </label>
                <input
                  type="date"
                  className={`${fieldCls} mt-1`}
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
              </div>
            )}

            {dateMode === "rango" && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Desde
                  </label>
                  <input
                    type="date"
                    className={`${fieldCls} mt-1`}
                    value={desde}
                    max={hasta || undefined}
                    onChange={(e) => setDesde(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Hasta
                  </label>
                  <input
                    type="date"
                    className={`${fieldCls} mt-1`}
                    value={hasta}
                    min={desde || undefined}
                    onChange={(e) => setHasta(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Cliente
              </label>
              <select
                className={`${fieldCls} mt-1`}
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">Todos los clientes</option>
                {options.clientes.map((c) => (
                  <option key={c.id || ""} value={c.id || ""}>
                    {c.nombre || "(sin nombre)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Trabajador
              </label>
              <select
                className={`${fieldCls} mt-1`}
                value={trabajadorId}
                onChange={(e) => setTrabajadorId(e.target.value)}
              >
                <option value="">Todos los trabajadores</option>
                {options.trabajadores.map((t) => (
                  <option key={t.id || ""} value={t.id || ""}>
                    {t.nombre || t.email || "(sin nombre)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {loading
                ? "Leyendo archivo…"
                : `${records.length} tarea${
                    records.length === 1 ? "" : "s"
                  } archivada${records.length === 1 ? "" : "s"}`}
            </span>
            {hayFiltros && (
              <button
                onClick={limpiar}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </motion.section>

        <motion.div
          className={`${glassCard} rounded-3xl p-0 overflow-auto`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <table className="min-w-full text-sm text-slate-800">
            <thead className="bg-black/5">
              <tr className="text-left">
                <th className="p-3 font-semibold text-slate-700">Creación</th>
                <th className="p-3 font-semibold text-slate-700">Cliente</th>
                <th className="p-3 font-semibold text-slate-700">Trabajador</th>
                <th className="p-3 font-semibold text-slate-700">Tarea</th>
                <th className="p-3 font-semibold text-slate-700">Comentario final</th>
                <th className="p-3 font-semibold text-slate-700">Archivada</th>
                <th className="p-3 font-semibold text-slate-700"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <>
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 20) * 0.02 }}
                    className="border-t border-black/10"
                  >
                    <td className="p-3 whitespace-nowrap text-slate-600">
                      {formatDate(r.creadaEn)}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-700">
                        {r.cliente?.nombre || "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.cliente?.direccion || "—"}
                      </div>
                    </td>
                    <td className="p-3 text-slate-700">
                      {r.trabajador?.nombre || r.trabajador?.email || "—"}
                    </td>
                    <td className="p-3 text-slate-700">{r.titulo}</td>
                    <td
                      className="p-3 max-w-xs truncate text-xs text-slate-600"
                      title={r.comentarioFinal || ""}
                    >
                      {r.comentarioFinal || "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs text-slate-600">
                      {formatDateTime(r.archivadaEn)}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [r.id]: !prev[r.id],
                          }))
                        }
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        {expanded[r.id] ? "Ocultar" : "Ver más..."}
                      </button>
                    </td>
                  </motion.tr>
                  {expanded[r.id] && (
                    <tr className="border-t border-black/10 bg-slate-100/50">
                      <td className="p-4 text-slate-700" colSpan={7}>
                        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                          <div>
                            <div className="text-[11px] text-slate-500">Teléfono cliente</div>
                            <div className="font-medium">{r.cliente?.telefono || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Teléfono contacto</div>
                            <div className="font-medium">{r.telefonoContacto || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">IP asignada</div>
                            <div className="font-medium">{r.cliente?.ipAsignada || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Completada en</div>
                            <div className="font-medium">{formatDateTime(r.completadaEn)}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Creada por</div>
                            <div className="font-medium">
                              {r.creadaPor?.nombre || r.creadaPor?.email || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Archivada por</div>
                            <div className="font-medium">
                              {r.archivadaPor?.nombre || r.archivadaPor?.email || "—"}
                            </div>
                          </div>
                          <div className="col-span-2 md:col-span-3">
                            <div className="text-[11px] text-slate-500">Descripción</div>
                            <div className="whitespace-pre-wrap font-medium">
                              {r.descripcion || "—"}
                            </div>
                          </div>
                          {r.evidenciaUrl && (
                            <div>
                              <div className="text-[11px] text-slate-500">Evidencia</div>
                              <a
                                className="font-medium text-emerald-600 hover:underline"
                                href={`${getApiOrigin()}${r.evidenciaUrl}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Ver foto
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={7}>
                    {error ||
                      (hayFiltros
                        ? "Ningún registro coincide con los filtros."
                        : "Aún no hay tareas archivadas.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
}
