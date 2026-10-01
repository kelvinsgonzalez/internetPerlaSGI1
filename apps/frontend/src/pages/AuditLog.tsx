import { motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AUDIT_ACTIONS,
  AUDIT_MODULES,
  downloadAuditCsv,
  getAuditOptions,
  listAudit,
  type AuditLogEntry,
  type AuditOptions,
  type AuditQuery,
} from "../services/audit";
import { ROLE_LABEL, type Role } from "../services/roles";

const glassCard =
  "backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30";

const fieldCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400";

const PAGE_SIZE = 50;

const ACTION_STYLE: Record<string, string> = {
  CREAR: "bg-emerald-100 text-emerald-800",
  ACTUALIZAR: "bg-sky-100 text-sky-800",
  ELIMINAR: "bg-rose-100 text-rose-800",
  LOGIN: "bg-violet-100 text-violet-800",
  LOGIN_FALLIDO: "bg-amber-100 text-amber-900",
};

const moduleLabel = (m: string) => AUDIT_MODULES[m] ?? m;

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

export default function AuditLog() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<AuditOptions>({ modules: [], users: [] });
  const [expanded, setExpanded] = useState<string | null>(null);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [userId, setUserId] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [success, setSuccess] = useState<"" | "true" | "false">("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // La búsqueda libre espera a que se deje de escribir para no consultar por tecla.
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo<AuditQuery>(
    () => ({ desde, hasta, userId, module, action, success, q }),
    [desde, hasta, userId, module, action, success, q]
  );

  useEffect(() => setPage(1), [filters]);

  // Al cambiar un filtro se pide la página vieja y luego la 1; sólo vale la
  // respuesta de la última petición, llegue en el orden que llegue.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listAudit({ ...filters, page, pageSize: PAGE_SIZE });
      if (id !== requestId.current) return;
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      if (id !== requestId.current) return;
      setError(e?.response?.data?.message || "No se pudo cargar la bitácora.");
      setItems([]);
      setTotal(0);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getAuditOptions().then(setOptions).catch(() => {});
  }, []);

  const onExport = async () => {
    try {
      await downloadAuditCsv(filters);
    } catch {
      toast.error("No se pudo exportar la bitácora");
    }
  };

  const clearFilters = () => {
    setDesde("");
    setHasta("");
    setUserId("");
    setModule("");
    setAction("");
    setSuccess("");
    setSearch("");
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(desde || hasta || userId || module || action || success || search);

  return (
    <div className="relative min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />

      <div className="relative z-10 flex flex-1 flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Bitácora de auditoría
            </motion.h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Registro de todo lo que se crea, edita o elimina en el sistema y de
              cada inicio de sesión: quién, cuándo, desde dónde y con qué datos.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <RefreshCw size={16} /> Actualizar
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600"
            >
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </header>

        <section className={`${glassCard} rounded-3xl p-4 sm:p-5`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-slate-600">
              Desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={`${fieldCls} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Hasta
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={`${fieldCls} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Usuario
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className={`${fieldCls} mt-1`}>
                <option value="">Todos</option>
                {options.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ? `${u.name} (${u.email})` : u.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Módulo
              <select value={module} onChange={(e) => setModule(e.target.value)} className={`${fieldCls} mt-1`}>
                <option value="">Todos</option>
                {options.modules.map((m) => (
                  <option key={m} value={m}>{moduleLabel(m)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Acción
              <select value={action} onChange={(e) => setAction(e.target.value)} className={`${fieldCls} mt-1`}>
                <option value="">Todas</option>
                {Object.entries(AUDIT_ACTIONS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Resultado
              <select value={success} onChange={(e) => setSuccess(e.target.value as any)} className={`${fieldCls} mt-1`}>
                <option value="">Todos</option>
                <option value="true">Exitoso</option>
                <option value="false">Con error</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Buscar
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Correo, ruta, id o dato modificado…"
                className={`${fieldCls} mt-1`}
              />
            </label>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-3 text-xs font-semibold text-emerald-700 hover:underline">
              Limpiar filtros
            </button>
          )}
        </section>

        <section className={`${glassCard} overflow-hidden rounded-3xl`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              {loading ? "Cargando…" : `${total.toLocaleString()} registro${total === 1 ? "" : "s"}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
                className="rounded-lg border border-slate-200 p-1 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="tabular-nums">{page} / {pages}</span>
              <button
                disabled={page >= pages || loading}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Página siguiente"
                className="rounded-lg border border-slate-200 p-1 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {error && <div className="p-6 text-sm text-rose-600">{error}</div>}
          {!error && !loading && items.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay registros con estos filtros.
            </div>
          )}

          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Usuario</th>
                    <th className="px-4 py-2">Acción</th>
                    <th className="px-4 py-2">Módulo</th>
                    <th className="px-4 py-2">Ruta</th>
                    <th className="px-4 py-2">Resultado</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((r) => {
                    const isOpen = expanded === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr
                          className="cursor-pointer align-top transition hover:bg-emerald-50/50"
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                        >
                          <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-600">
                            {formatDateTime(r.createdAt)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="font-medium text-slate-800">{r.userName || r.userEmail || "—"}</div>
                            <div className="text-xs text-slate-500">
                              {r.userName && r.userEmail ? r.userEmail : ""}
                              {r.userRole ? ` · ${ROLE_LABEL[r.userRole as Role] ?? r.userRole}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACTION_STYLE[r.action] ?? "bg-slate-100 text-slate-700"}`}>
                              {AUDIT_ACTIONS[r.action] ?? r.action}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-700">{moduleLabel(r.module)}</td>
                          <td className="max-w-[260px] truncate px-4 py-2 font-mono text-xs text-slate-500" title={`${r.method} /${r.path}`}>
                            {r.method} /{r.path}
                          </td>
                          <td className="px-4 py-2">
                            {r.success ? (
                              <span className="text-xs font-semibold text-emerald-700">OK</span>
                            ) : (
                              <span className="text-xs font-semibold text-rose-600">Error {r.statusCode ?? ""}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-slate-400">
                            <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={7} className="px-4 py-3">
                              <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                                <div><dt className="inline font-semibold text-slate-600">Registro afectado: </dt><dd className="inline font-mono text-slate-700">{r.entityId || "—"}</dd></div>
                                <div><dt className="inline font-semibold text-slate-600">IP: </dt><dd className="inline font-mono text-slate-700">{r.ip || "—"}</dd></div>
                                <div className="sm:col-span-2"><dt className="inline font-semibold text-slate-600">Navegador: </dt><dd className="inline text-slate-700">{r.userAgent || "—"}</dd></div>
                                {r.error && (
                                  <div className="sm:col-span-2"><dt className="inline font-semibold text-rose-600">Error: </dt><dd className="inline text-rose-700">{r.error}</dd></div>
                                )}
                              </dl>
                              {r.details && (
                                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-emerald-100">
                                  {JSON.stringify(r.details, null, 2)}
                                </pre>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
