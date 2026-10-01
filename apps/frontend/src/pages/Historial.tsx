import { motion } from "framer-motion";
import { ArrowLeft, Download, History, List, Loader2, Pencil, Plus, Printer, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import BorrarTodoModal from "../components/historial/BorrarTodoModal";
import ImportModal from "../components/historial/ImportModal";
import RegistroModal from "../components/historial/RegistroModal";
import TodosLosRegistros, { type TodosHandle } from "../components/historial/TodosLosRegistros";
import { useAuth } from "../hooks/useAuth";
import {
  actualizarCobro,
  borrarTodoElHistorial,
  buscarClientes,
  COLUMNAS,
  crearCobro,
  eliminarCobro,
  obtenerFicha,
  type ClienteResultado,
  type CobroHistorico,
  type CobroInput,
  type Ficha,
} from "../services/historial";

const glassCard = "backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30";

const texto = (v: string | null | undefined) => (v && v.trim() ? v : "—");

// Columnas cortas que no deben partirse en dos líneas; el resto puede hacer salto.
const SIN_SALTO = new Set<string>(["fecha", "cantidadMeses", "total", "codigo"]);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const nombreArchivo = (cliente: string) =>
  `historial-${cliente.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cliente"}`;

/** CSV para Excel: BOM UTF-8 y `;` como separador (configuración regional es-GT). */
function descargarCSV(ficha: Ficha) {
  const celda = (v: string | null) => {
    const s = v ?? "";
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const filas = [
    ["Cliente", "Ubicación", ...COLUMNAS.map((c) => c.label)].join(";"),
    ...ficha.registros.map((r) =>
      [celda(r.cliente), celda(r.ubicacion), ...COLUMNAS.map((c) => celda(r[c.key as keyof CobroHistorico] as string | null))].join(";")
    ),
  ];
  const blob = new Blob(["﻿" + filas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo(ficha.cliente)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Imprime la ficha (o la guarda como PDF desde el diálogo del navegador).
 *
 * Se usa un iframe oculto en la misma página y no una ventana emergente: la
 * ventana con `document.write` + `onload` fallaba según el navegador (Safari
 * no siempre dispara el onload o imprime en blanco) y los bloqueadores de
 * ventanas emergentes la impedían.
 */
function imprimir(ficha: Ficha) {
  const ubicacion = ficha.registros.find((r) => r.ubicacion)?.ubicacion ?? "";
  const codigos = [...new Set(ficha.registros.map((r) => r.codigo).filter(Boolean))].join(", ");
  const titulo = nombreArchivo(ficha.cliente);
  const filas = ficha.registros
    .map((r) => `<tr>${COLUMNAS.map((c) => `<td${SIN_SALTO.has(c.key) ? ' class="nw"' : ""}>${escapeHtml(texto(r[c.key as keyof CobroHistorico] as string | null))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${escapeHtml(titulo)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:18px;margin:0 0 2px} h2{font-size:14px;margin:0 0 16px;color:#475569;font-weight:600}
  .meta{font-size:12px;color:#334155;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th,td{border:1px solid #cbd5e1;padding:3px 5px;text-align:left;vertical-align:top;overflow-wrap:break-word}
  .nw{white-space:nowrap}
  th{background:#ecfdf5}
  tr{break-inside:avoid}
  @page{size:portrait;margin:12mm}
</style></head><body>
<h1>Iperla · Historial de cobros</h1>
<h2>${escapeHtml(ficha.cliente)}</h2>
<div class="meta">${ubicacion ? `Ubicación: ${escapeHtml(ubicacion)} · ` : ""}${codigos ? `Código: ${escapeHtml(codigos)} · ` : ""}Registros: ${ficha.registros.length} · Impreso: ${new Date().toLocaleString("es-GT")}</div>
<table><thead><tr>${COLUMNAS.map((c) => `<th${SIN_SALTO.has(c.key) ? ' class="nw"' : ""}>${c.label}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  // El nombre sugerido del PDF sale del título de la página principal en
  // algunos navegadores: se cambia mientras dura la impresión.
  const tituloOriginal = document.title;
  let limpio = false;
  const limpiar = () => {
    if (limpio) return;
    limpio = true;
    document.title = tituloOriginal;
    iframe.remove();
  };
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      limpiar();
      toast.error("No se pudo preparar la impresión");
      return;
    }
    win.addEventListener("afterprint", () => setTimeout(limpiar, 0), { once: true });
    // Respaldo por si el navegador no emite "afterprint".
    setTimeout(limpiar, 60_000);
    document.title = titulo;
    win.focus();
    win.print();
  };
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}

export default function Historial() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  // "todos" (listado completo por fecha del documento) es exclusivo del ADMIN.
  const [vista, setVista] = useState<"buscar" | "todos">("buscar");
  const todosRef = useRef<TodosHandle>(null);
  // Hubo cambios mientras la ficha tapaba la lista: se refresca al volver.
  const listaDesactualizada = useRef(false);

  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ClienteResultado[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);

  const [modalRegistro, setModalRegistro] = useState<{ open: boolean; registro: CobroHistorico | null }>({
    open: false,
    registro: null,
  });
  const [modalImport, setModalImport] = useState(false);
  const [modalBorrarTodo, setModalBorrarTodo] = useState(false);
  // Cambia tras vaciar el historial para reiniciar la vista de consulta.
  const [reinicio, setReinicio] = useState(0);

  // Búsqueda por nombre o código, con debounce.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResultados([]);
      return;
    }
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const data = await buscarClientes(term);
        if (vigente) setResultados(data);
      } catch (err: any) {
        if (vigente) toast.error(err?.response?.data?.message || "No se pudo buscar");
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q]);

  const abrirFicha = async (cliente: string) => {
    setCargandoFicha(true);
    try {
      setFicha(await obtenerFicha(cliente));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "No se pudo cargar el historial");
    } finally {
      setCargandoFicha(false);
    }
  };

  /**
   * Tras guardar, eliminar o importar se refresca sólo lo que está en
   * pantalla: la ficha abierta, o si no, la vista activa (nunca la oculta).
   */
  const recargar = async () => {
    if (ficha) {
      listaDesactualizada.current = true;
      await abrirFicha(ficha.cliente);
    } else if (vista === "todos") todosRef.current?.recargar();
    else if (q.trim().length >= 2) setResultados(await buscarClientes(q.trim()).catch(() => resultados));
  };

  const guardar = async (input: CobroInput) => {
    try {
      if (modalRegistro.registro) {
        await actualizarCobro(modalRegistro.registro.id, input);
        toast.success("Registro actualizado");
      } else {
        await crearCobro(input);
        toast.success("Registro agregado");
      }
      setModalRegistro({ open: false, registro: null });
      // Si cambió el nombre del cliente, la ficha a mostrar es la del nuevo nombre.
      const destino = input.cliente?.trim() || ficha?.cliente;
      if (destino && ficha) {
        listaDesactualizada.current = true;
        await abrirFicha(destino);
      }
      else await recargar();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message || "No se pudo guardar");
    }
  };

  const borrar = async (registro: CobroHistorico) => {
    if (!window.confirm(`¿Eliminar el registro del ${texto(registro.fecha)} (${texto(registro.total)})?`)) return;
    try {
      await eliminarCobro(registro.id);
      toast.success("Registro eliminado");
      await recargar();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "No se pudo eliminar");
    }
  };

  const vaciarHistorial = async () => {
    try {
      const { borrados } = await borrarTodoElHistorial();
      toast.success(`Historial vaciado: ${borrados.toLocaleString()} registros eliminados`);
      setModalBorrarTodo(false);
      // Nada de lo mostrado sigue existiendo: se limpian ficha, búsqueda y consulta.
      setFicha(null);
      setQ("");
      setResultados([]);
      listaDesactualizada.current = false;
      setReinicio((n) => n + 1);
    } catch (err: any) {
      const message = err?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message || "No se pudo borrar el historial");
    }
  };

  const volverDeFicha = () => {
    setFicha(null);
    if (!listaDesactualizada.current) return;
    listaDesactualizada.current = false;
    if (vista === "todos") todosRef.current?.recargar();
    else if (q.trim().length >= 2) buscarClientes(q.trim()).then(setResultados).catch(() => {});
  };

  const ultimo = ficha?.resumen.ultimo;
  const ubicacion = ficha?.registros.find((r) => r.ubicacion)?.ubicacion;

  return (
    <div className="relative min-h-full px-3 py-4 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="relative z-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              <History className="h-8 w-8 text-emerald-600" /> Historial de cobros
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {vista === "todos" && !ficha
                ? "Consulta los registros por nombre o código, por semana o los de hoy y ayer (según la fecha del documento)."
                : "Busca un cliente por su nombre o por su código."}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setModalRegistro({ open: true, registro: null })}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" /> Nuevo registro
              </button>
              <button
                onClick={() => setModalImport(true)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
              >
                <Upload className="h-4 w-4" /> Importar
              </button>
              <button
                onClick={() => setModalBorrarTodo(true)}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Borrar todo el historial
              </button>
            </div>
          )}
        </header>

        {isAdmin && !ficha && (
          <div role="tablist" className="inline-flex rounded-full border border-emerald-200 bg-white p-1 shadow-sm">
            {(
              [
                { id: "buscar", label: "Buscar cliente", icon: Search },
                { id: "todos", label: "Consultar registros", icon: List },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={vista === id}
                onClick={() => setVista(id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  vista === id ? "bg-emerald-600 text-white shadow" : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {/* Se mantiene montado (oculto) al abrir una ficha para no perder filtros ni página. */}
        {isAdmin && vista === "todos" && (
          <div className={ficha ? "hidden" : undefined}>
            <TodosLosRegistros
              key={reinicio}
              ref={todosRef}
              onAbrirCliente={abrirFicha}
              onEditar={(registro) => setModalRegistro({ open: true, registro })}
              onEliminar={borrar}
            />
          </div>
        )}

        {!ficha && vista === "buscar" && (
          <motion.section className={`${glassCard} rounded-3xl p-5`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
              <input
                autoFocus
                type="search"
                aria-label="Nombre del cliente o código"
                placeholder="Nombre del cliente o código..."
                className="w-full rounded-full border border-emerald-200/70 bg-white py-3 pl-11 pr-4 text-base shadow-inner focus:border-emerald-400 focus:outline-none"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="mt-4">
              {buscando && (
                <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                </p>
              )}
              {!buscando && q.trim().length >= 2 && resultados.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">No se encontraron clientes.</p>
              )}
              {!buscando && q.trim().length < 2 && (
                <p className="py-6 text-center text-sm text-slate-400">Escribe al menos 2 caracteres.</p>
              )}
              <ul className="divide-y divide-slate-100">
                {!buscando &&
                  resultados.map((r) => (
                    <li key={r.cliente}>
                      <button
                        onClick={() => abrirFicha(r.cliente)}
                        className="flex w-full items-center justify-between gap-4 rounded-2xl px-3 py-3 text-left transition hover:bg-emerald-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{r.cliente}</p>
                          <p className="truncate text-xs text-slate-500">
                            {[r.ubicacion, r.codigos.length ? `Código: ${r.codigos.join(", ")}` : null].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {r.registros} {r.registros === 1 ? "registro" : "registros"}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </motion.section>
        )}

        {cargandoFicha && !ficha && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
          </p>
        )}

        {ficha && (
          <motion.section className="space-y-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={volverDeFicha}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" /> {vista === "todos" ? "Volver al listado" : "Volver a la búsqueda"}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => descargarCSV(ficha)}
                  disabled={!ficha.registros.length}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" /> Descargar
                </button>
                <button
                  onClick={() => imprimir(ficha)}
                  disabled={!ficha.registros.length}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" /> Imprimir / PDF
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setModalRegistro({ open: true, registro: null })}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
                  >
                    <Plus className="h-4 w-4" /> Agregar pago
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className={`${glassCard} rounded-3xl p-5 lg:col-span-1`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Cliente</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{ficha.cliente}</h2>
                <p className="mt-1 text-sm text-slate-500">{texto(ubicacion)}</p>
                <p className="mt-3 text-sm text-slate-600">
                  <b>{ficha.resumen.registros}</b> {ficha.resumen.registros === 1 ? "registro" : "registros"}
                </p>
              </div>
              <div className={`${glassCard} rounded-3xl p-5 lg:col-span-2`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Último pago</p>
                {ultimo ? (
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    {COLUMNAS.map((c) => (
                      <div key={c.key}>
                        <dt className="text-xs text-slate-500">{c.label}</dt>
                        <dd className="font-medium text-slate-800">{texto(ultimo[c.key as keyof CobroHistorico] as string | null)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Sin registros.</p>
                )}
              </div>
            </div>

            <div className={`${glassCard} overflow-hidden rounded-3xl`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-emerald-50/80 text-left text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    <tr>
                      {COLUMNAS.map((c) => (
                        <th key={c.key} className="whitespace-nowrap px-3 py-3">
                          {c.label}
                        </th>
                      ))}
                      {isAdmin && <th className="px-3 py-3 text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ficha.registros.map((r) => (
                      <tr key={r.id} className="hover:bg-emerald-50/40">
                        {COLUMNAS.map((c) => (
                          <td
                            key={c.key}
                            className={`px-3 py-2.5 text-slate-700 ${SIN_SALTO.has(c.key) ? "whitespace-nowrap" : "min-w-[7rem]"}`}
                          >
                            {texto(r[c.key as keyof CobroHistorico] as string | null)}
                          </td>
                        ))}
                        {isAdmin && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <button
                              onClick={() => setModalRegistro({ open: true, registro: r })}
                              title="Editar"
                              aria-label="Editar registro"
                              className="mr-1 rounded-full bg-slate-100/70 p-2 text-slate-600 hover:bg-slate-200"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => borrar(r)}
                              title="Eliminar"
                              aria-label="Eliminar registro"
                              className="rounded-full bg-red-100/60 p-2 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {!ficha.registros.length && (
                      <tr>
                        <td colSpan={COLUMNAS.length + (isAdmin ? 1 : 0)} className="px-4 py-8 text-center text-slate-500">
                          Este cliente ya no tiene registros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        )}
      </div>

      {isAdmin && (
        <>
          <RegistroModal
            open={modalRegistro.open}
            registro={modalRegistro.registro}
            clienteInicial={ficha?.cliente}
            onClose={() => setModalRegistro({ open: false, registro: null })}
            onSave={guardar}
          />
          <ImportModal open={modalImport} onClose={() => setModalImport(false)} onImported={recargar} />
          <BorrarTodoModal
            open={modalBorrarTodo}
            onClose={() => setModalBorrarTodo(false)}
            onConfirm={vaciarHistorial}
          />
        </>
      )}
    </div>
  );
}
