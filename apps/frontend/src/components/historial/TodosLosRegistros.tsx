import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  COLUMNAS,
  listarTodos,
  sugerirClientes,
  type ClienteResultado,
  type CobroHistorico,
  type RegistroListado,
  type TodosQuery,
} from "../../services/historial";

const glassCard = "backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30";
const selectCls =
  "w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400";

const PAGE_SIZE = 50;
const texto = (v: string | null | undefined) => (v && v.trim() ? v : "—");
const SIN_SALTO = new Set<string>(["fecha", "cantidadMeses", "total", "codigo"]);

// ---- Fechas (siempre en hora local; toISOString usaría UTC) ----

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const aFecha = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const sumarDias = (iso: string, dias: number) => {
  const d = aFecha(iso);
  return isoLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias));
};
const hoyIso = () => isoLocal(new Date());
const SEMANA_MS = 7 * 86_400_000;

/**
 * Semanas ISO 8601 (las del calendario en Guatemala): van de lunes a domingo
 * y la semana 1 es la que contiene el 4 de enero. Algunos años tienen 53.
 */
const lunesSemana1 = (anio: number) => {
  const cuatroEnero = isoLocal(new Date(anio, 0, 4));
  const dow = aFecha(cuatroEnero).getDay(); // 0 = domingo
  return sumarDias(cuatroEnero, -((dow + 6) % 7));
};
const semanasDelAnio = (anio: number) =>
  Math.round((aFecha(lunesSemana1(anio + 1)).getTime() - aFecha(lunesSemana1(anio)).getTime()) / SEMANA_MS);
const rangoSemana = (anio: number, n: number) => {
  const desde = sumarDias(lunesSemana1(anio), (n - 1) * 7);
  return { desde, hasta: sumarDias(desde, 6) };
};
/** Año ISO y número de semana de una fecha. */
const semanaDe = (iso: string) => {
  const d = aFecha(iso);
  const jueves = sumarDias(iso, 3 - ((d.getDay() + 6) % 7));
  const anio = aFecha(jueves).getFullYear();
  const n = Math.round((aFecha(jueves).getTime() - aFecha(lunesSemana1(anio)).getTime()) / SEMANA_MS) + 1;
  return { anio, n };
};

const diaMes = (iso: string) => aFecha(iso).toLocaleDateString("es-GT", { day: "numeric", month: "short" });
const diaMesLargo = (iso: string) =>
  aFecha(iso).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
const formatoDia = (iso: string) =>
  aFecha(iso).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

type Modo = "nombre" | "fecha" | "dia";

const MODOS: { id: Modo; label: string; icon: typeof Search }[] = [
  { id: "nombre", label: "Buscar por nombre o código", icon: Search },
  { id: "fecha", label: "Buscar por semana", icon: CalendarRange },
  { id: "dia", label: "Consultar hoy o ayer", icon: CalendarClock },
];

export type TodosHandle = { recargar: () => void };

type Props = {
  onAbrirCliente: (cliente: string) => void;
  onEditar: (registro: CobroHistorico) => void;
  onEliminar: (registro: CobroHistorico) => void;
};

/**
 * Consulta de registros del historial (sólo ADMIN). Nunca se piden registros
 * hasta que el usuario elige qué ver:
 * - nombre/código: mientras escribe sólo se sugieren NOMBRES; los registros se
 *   piden al confirmar uno;
 * - semana: al elegir el número de semana (lunes a domingo);
 * - hoy o ayer: al tocar el botón.
 */
const TodosLosRegistros = forwardRef<TodosHandle, Props>(function TodosLosRegistros(
  { onAbrirCliente, onEditar, onEliminar },
  ref
) {
  const [items, setItems] = useState<RegistroListado[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [orden, setOrden] = useState<"desc" | "asc">("desc");

  const [modo, setModo] = useState<Modo | null>(null);

  // Nombre: texto → sugerencias → elegido (por confirmar) → cliente confirmado.
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState<ClienteResultado[]>([]);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState<ClienteResultado | null>(null);
  const [cliente, setCliente] = useState<string | null>(null);

  // Semana: año ISO y número; nada elegido al entrar.
  const hoy = hoyIso();
  const actual = semanaDe(hoy);
  const [anio, setAnio] = useState(actual.anio);
  const [semanaNum, setSemanaNum] = useState<number | null>(null);

  const [dia, setDia] = useState<string | null>(null);

  // Sugerencias: sólo nombres, con espera tras teclear y descartando
  // respuestas viejas. No se busca de nuevo el nombre ya elegido.
  const sugerenciaId = useRef(0);
  useEffect(() => {
    const term = busqueda.trim();
    const id = ++sugerenciaId.current;
    if (modo !== "nombre" || term.length < 2 || porConfirmar || cliente) {
      setSugerencias([]);
      setSugiriendo(false);
      return;
    }
    setSugiriendo(true);
    const t = setTimeout(async () => {
      try {
        const data = await sugerirClientes(term);
        if (id === sugerenciaId.current) setSugerencias(data);
      } catch {
        if (id === sugerenciaId.current) setSugerencias([]);
      } finally {
        if (id === sugerenciaId.current) setSugiriendo(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, modo, porConfirmar, cliente]);

  /** Cambiar de modo descarta lo elegido en el anterior: nada se consulta solo. */
  const elegirModo = (m: Modo) => {
    if (m === modo) return;
    setModo(m);
    setBusqueda("");
    setSugerencias([]);
    setPorConfirmar(null);
    setCliente(null);
    setAnio(actual.anio);
    setSemanaNum(null);
    setDia(null);
    setPage(1);
  };
  const escribir = (valor: string) => {
    setBusqueda(valor);
    setPorConfirmar(null);
    setCliente(null);
    setPage(1);
  };
  const elegirSugerencia = (s: ClienteResultado) => {
    setPorConfirmar(s);
    setBusqueda(s.cliente);
    setSugerencias([]);
  };
  const confirmar = () => {
    if (!porConfirmar) return;
    setCliente(porConfirmar.cliente);
    setPorConfirmar(null);
    setPage(1);
  };
  const cambiarAnio = (delta: number) => {
    setAnio((a) => a + delta);
    setSemanaNum(null);
    setPage(1);
  };
  const elegirSemana = (n: number | null) => {
    setSemanaNum(n);
    setPage(1);
  };
  const elegirDia = (valor: string) => {
    setDia(valor);
    setPage(1);
  };
  const cambiarOrden = () => {
    setOrden((o) => (o === "desc" ? "asc" : "desc"));
    setPage(1);
  };

  const rango = semanaNum ? rangoSemana(anio, semanaNum) : null;

  /** Consulta vigente, o null si el usuario aún no eligió (no se llama al API). */
  const consulta = useMemo<TodosQuery | null>(() => {
    if (modo === "nombre") return cliente ? { cliente } : null;
    if (modo === "fecha") return rango ? { desde: rango.desde, hasta: rango.hasta } : null;
    if (modo === "dia") return dia ? { desde: dia, hasta: dia } : null;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, cliente, rango?.desde, rango?.hasta, dia]);

  // Sólo vale la respuesta de la última petición, llegue en el orden que llegue.
  const peticion = useRef(0);
  const cargar = useCallback(async () => {
    const id = ++peticion.current;
    if (!consulta) {
      setItems([]);
      setTotal(0);
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const data = await listarTodos({ ...consulta, orden, page, pageSize: PAGE_SIZE });
      if (id !== peticion.current) return;
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      if (id !== peticion.current) return;
      toast.error(err?.response?.data?.message || "No se pudieron cargar los registros");
      setItems([]);
      setTotal(0);
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, [consulta, orden, page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useImperativeHandle(ref, () => ({ recargar: cargar }), [cargar]);

  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ayer = sumarDias(hoy, -1);
  const totalSemanas = semanasDelAnio(anio);
  // No se ofrecen semanas futuras.
  const ultimaSemana = anio === actual.anio ? actual.n : totalSemanas;

  const descripcion =
    modo === "nombre" && cliente
      ? cliente
      : modo === "fecha" && rango
        ? `semana ${semanaNum} · ${diaMes(rango.desde)} al ${diaMes(rango.hasta)} ${anio}`
        : modo === "dia" && dia
          ? formatoDia(dia)
          : null;

  const diaBtn = (valor: string, label: string) => (
    <button
      onClick={() => elegirDia(valor)}
      aria-pressed={dia === valor}
      className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
        dia === valor
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
          : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-4">
      <div className={`${glassCard} space-y-4 rounded-3xl p-4 sm:p-5`}>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODOS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => elegirModo(id)}
              aria-pressed={modo === id}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                modo === id
                  ? "border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                  : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </button>
          ))}
        </div>

        {modo === "nombre" && (
          <div className="mx-auto w-full max-w-2xl space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
              <input
                autoFocus
                type="search"
                role="combobox"
                aria-expanded={sugerencias.length > 0}
                aria-controls="historial-sugerencias"
                aria-label="Nombre del cliente o código"
                value={busqueda}
                onChange={(e) => escribir(e.target.value)}
                placeholder="Escribe el nombre o el código del cliente…"
                className="w-full rounded-full border border-emerald-200/70 bg-white py-3 pl-11 pr-10 text-base shadow-inner focus:border-emerald-400 focus:outline-none"
              />
              {sugiriendo && (
                <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-500" />
              )}
            </div>

            {sugerencias.length > 0 && (
              <ul
                id="historial-sugerencias"
                role="listbox"
                className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-lg"
              >
                {sugerencias.map((s) => (
                  <li key={s.cliente} role="option" aria-selected={false}>
                    <button
                      onClick={() => elegirSugerencia(s)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-emerald-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-800">{s.cliente}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {[s.ubicacion, s.codigos.length ? `Código: ${s.codigos.join(", ")}` : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {s.registros} {s.registros === 1 ? "registro" : "registros"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!sugiriendo && !porConfirmar && !cliente && busqueda.trim().length >= 2 && sugerencias.length === 0 && (
              <p className="text-center text-sm text-slate-500">No hay clientes que coincidan.</p>
            )}
            {busqueda.trim().length < 2 && (
              <p className="text-center text-sm text-slate-400">Escribe al menos 2 letras para ver sugerencias.</p>
            )}

            {porConfirmar && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 text-center sm:flex-row sm:text-left">
                <UserCheck className="h-8 w-8 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-600">¿Quieres ver los registros de este cliente?</p>
                  <p className="truncate font-bold text-slate-900">{porConfirmar.cliente}</p>
                  <p className="text-xs text-slate-500">
                    {porConfirmar.registros} {porConfirmar.registros === 1 ? "registro" : "registros"}
                    {porConfirmar.ubicacion ? ` · ${porConfirmar.ubicacion}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => escribir("")}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Elegir otro
                  </button>
                  <button
                    autoFocus
                    onClick={confirmar}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
                  >
                    Ver registros
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {modo === "fecha" && (
          <div className="mx-auto w-full max-w-md space-y-3">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-600">Año</span>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    onClick={() => cambiarAnio(-1)}
                    aria-label="Año anterior"
                    className="rounded-full border border-emerald-200 bg-white p-2 text-emerald-700 hover:bg-emerald-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-bold tabular-nums text-slate-800">{anio}</span>
                  <button
                    onClick={() => cambiarAnio(1)}
                    disabled={anio >= actual.anio}
                    aria-label="Año siguiente"
                    className="rounded-full border border-emerald-200 bg-white p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <label className="text-xs font-semibold text-slate-600">
                Número de semana
                <select
                  value={semanaNum ?? ""}
                  onChange={(e) => elegirSemana(e.target.value ? Number(e.target.value) : null)}
                  className={`${selectCls} mt-1`}
                >
                  <option value="">Elige la semana…</option>
                  {Array.from({ length: totalSemanas }, (_, i) => i + 1).map((n) => {
                    const r = rangoSemana(anio, n);
                    return (
                      <option key={n} value={n} disabled={n > ultimaSemana}>
                        Semana {n} · {diaMes(r.desde)} – {diaMes(r.hasta)}
                        {anio === actual.anio && n === actual.n ? " (actual)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            {rango && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Semana {semanaNum} de {anio}
                </p>
                <p className="font-semibold text-slate-800 first-letter:uppercase">
                  {diaMesLargo(rango.desde)} — {diaMesLargo(rango.hasta)}
                </p>
              </div>
            )}
          </div>
        )}

        {modo === "dia" && (
          <div className="flex flex-wrap justify-center gap-2">
            {diaBtn(hoy, "Hoy")}
            {diaBtn(ayer, "Ayer")}
          </div>
        )}
      </div>

      {/* Los resultados sólo existen cuando el usuario ya eligió qué consultar. */}
      {consulta && (
        <div className={`${glassCard} overflow-hidden rounded-3xl`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
              <b className="text-slate-800">{total.toLocaleString()}</b> {total === 1 ? "registro" : "registros"}
              {descripcion && <span className="first-letter:uppercase">· {descripcion}</span>}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={cambiarOrden}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {orden === "desc" ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpNarrowWide className="h-4 w-4" />}
                {orden === "desc" ? "Recientes primero" : "Antiguos primero"}
              </button>
              {paginas > 1 && (
                <>
                  <button
                    disabled={page <= 1 || cargando}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Página anterior"
                    className="rounded-lg border border-slate-200 p-1 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="tabular-nums">
                    {page} / {paginas}
                  </span>
                  <button
                    disabled={page >= paginas || cargando}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Página siguiente"
                    className="rounded-lg border border-slate-200 p-1 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50/80 text-left text-xs font-semibold uppercase tracking-wide text-emerald-800">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3">{COLUMNAS[0].label}</th>
                  <th className="whitespace-nowrap px-3 py-3">Cliente</th>
                  <th className="whitespace-nowrap px-3 py-3">Ubicación</th>
                  {COLUMNAS.slice(1).map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-3">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-emerald-50/40">
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        {texto(r.fecha)}
                        {!r.fechaReconocida && (
                          <span title="Fecha sin formato reconocible: no aparece en las búsquedas por semana ni por día">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="min-w-[10rem] px-3 py-2.5">
                      <button onClick={() => onAbrirCliente(r.cliente)} className="text-left font-semibold text-emerald-700 hover:underline">
                        {r.cliente}
                      </button>
                    </td>
                    <td className="min-w-[7rem] px-3 py-2.5 text-slate-700">{texto(r.ubicacion)}</td>
                    {COLUMNAS.slice(1).map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 py-2.5 text-slate-700 ${SIN_SALTO.has(c.key) ? "whitespace-nowrap" : "min-w-[7rem]"}`}
                      >
                        {texto(r[c.key as keyof CobroHistorico] as string | null)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button
                        onClick={() => onEditar(r)}
                        title="Editar"
                        aria-label="Editar registro"
                        className="mr-1 rounded-full bg-slate-100/70 p-2 text-slate-600 hover:bg-slate-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onEliminar(r)}
                        title="Eliminar"
                        aria-label="Eliminar registro"
                        className="rounded-full bg-red-100/60 p-2 text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!cargando && items.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNAS.length + 3} className="px-4 py-8 text-center text-slate-500">
                      No hay registros para esta consulta.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
});

export default TodosLosRegistros;
