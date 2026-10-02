import api from "./api";

/**
 * Suspensiones: módulo independiente (base propia). Guarda una copia de los
 * datos del cliente, así que no depende de que el cliente siga existiendo.
 */

export type EstadoSuspension = "SUSPENDIDO" | "REACTIVADO_ACUERDO" | "RECOGER_EQUIPO" | "DESCONEXION";
export type TipoAsignacion = "RECOGER_EQUIPO" | "VISITA";
export type EstadoAsignacion = "PENDIENTE" | "EN_PROCESO" | "DEVUELTA" | "CERRADA";
export type ResultadoAsignacion =
  | "EQUIPO_RECOGIDO"
  | "CLIENTE_PAGO"
  | "CLIENTE_ACORDO"
  | "NO_ENCONTRADO"
  | "SE_NEGO"
  | "OTRO";
export type TipoAgenda = "COBRO_ACUERDO" | "VISITA" | "RECOGER_EQUIPO" | "SEGUIMIENTO" | "OTRO";
export type EstadoAgenda = "PENDIENTE" | "HECHO" | "CANCELADO";

export const ESTADOS: EstadoSuspension[] = ["SUSPENDIDO", "REACTIVADO_ACUERDO", "RECOGER_EQUIPO", "DESCONEXION"];

export const ESTADO_LABEL: Record<EstadoSuspension, string> = {
  SUSPENDIDO: "Suspendido",
  REACTIVADO_ACUERDO: "Reactivado con acuerdo",
  RECOGER_EQUIPO: "Recoger equipo",
  DESCONEXION: "Desconexión",
};

export const ESTADO_STYLE: Record<EstadoSuspension, string> = {
  SUSPENDIDO: "bg-amber-100 text-amber-800 border-amber-200",
  REACTIVADO_ACUERDO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RECOGER_EQUIPO: "bg-sky-100 text-sky-800 border-sky-200",
  DESCONEXION: "bg-rose-100 text-rose-800 border-rose-200",
};

export const TIPO_ASIGNACION_LABEL: Record<TipoAsignacion, string> = {
  RECOGER_EQUIPO: "Recoger equipo",
  VISITA: "Visita",
};

export const ESTADO_ASIGNACION_LABEL: Record<EstadoAsignacion, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  DEVUELTA: "Devuelta – por revisar",
  CERRADA: "Cerrada",
};

export const ESTADO_ASIGNACION_STYLE: Record<EstadoAsignacion, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  EN_PROCESO: "bg-sky-100 text-sky-800",
  DEVUELTA: "bg-violet-100 text-violet-800",
  CERRADA: "bg-slate-100 text-slate-600",
};

export const RESULTADO_LABEL: Record<ResultadoAsignacion, string> = {
  EQUIPO_RECOGIDO: "Equipo recogido",
  CLIENTE_PAGO: "El cliente pagó",
  CLIENTE_ACORDO: "El cliente propuso un acuerdo",
  NO_ENCONTRADO: "No se encontró al cliente",
  SE_NEGO: "El cliente se negó",
  OTRO: "Otro",
};

export const TIPO_AGENDA_LABEL: Record<TipoAgenda, string> = {
  COBRO_ACUERDO: "Cobro de acuerdo",
  VISITA: "Visita",
  RECOGER_EQUIPO: "Recoger equipo",
  SEGUIMIENTO: "Seguimiento",
  OTRO: "Otro",
};

export const TIPO_AGENDA_STYLE: Record<TipoAgenda, string> = {
  COBRO_ACUERDO: "bg-emerald-100 text-emerald-800",
  VISITA: "bg-sky-100 text-sky-800",
  RECOGER_EQUIPO: "bg-indigo-100 text-indigo-800",
  SEGUIMIENTO: "bg-amber-100 text-amber-800",
  OTRO: "bg-slate-100 text-slate-700",
};

export interface FechaAcuerdo {
  fecha: string;
  monto?: number | null;
  nota?: string | null;
}

export interface Suspension {
  id: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  clienteDireccion: string | null;
  clienteIp: string | null;
  clientePlan: string | null;
  clienteLatitud: string | null;
  clienteLongitud: string | null;
  clienteOrigenId: string | null;
  fechaSuspension: string;
  montoAdeudado: number;
  anuncio: string;
  estado: EstadoSuspension;
  acuerdoTexto: string | null;
  acuerdoFechas: FechaAcuerdo[] | null;
  recogerNota: string | null;
  recogerFecha: string | null;
  desconexionNota: string | null;
  montoPendienteFinal: number | null;
  creadoPorNombre: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asignacion {
  id: string;
  suspensionId: string;
  tipo: TipoAsignacion;
  instrucciones: string | null;
  telefonoContacto: string | null;
  fechaProgramada: string | null;
  trabajadorId: string;
  trabajadorNombre: string | null;
  asignadoPorNombre: string | null;
  estado: EstadoAsignacion;
  resultado: ResultadoAsignacion | null;
  informeTrabajador: string | null;
  evidenciaUrl: string | null;
  iniciadaEn: string | null;
  devueltaEn: string | null;
  revisionNota: string | null;
  revisadoPorNombre: string | null;
  cerradaEn: string | null;
  createdAt: string;
}

export interface AgendaEntrada {
  id: string;
  suspensionId: string | null;
  asignacionId: string | null;
  origen: string;
  fecha: string;
  hora: string | null;
  tipo: TipoAgenda;
  titulo: string;
  nota: string | null;
  clienteNombre: string | null;
  responsableId: string | null;
  responsableNombre: string | null;
  estado: EstadoAgenda;
  resolucionNota: string | null;
  resueltoPorNombre: string | null;
  resueltoEn: string | null;
  creadoPorNombre: string | null;
}

export interface Evento {
  id: string;
  tipo: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  nota: string | null;
  usuarioNombre: string | null;
  usuarioRol: string | null;
  createdAt: string;
}

export type SuspensionConAsignaciones = Suspension & { asignaciones: Asignacion[] };
export type SuspensionDetalle = Suspension & { asignaciones: Asignacion[]; agenda: AgendaEntrada[]; eventos: Evento[] };

export interface ListaSuspensiones {
  items: SuspensionConAsignaciones[];
  total: number;
  page: number;
  pageSize: number;
  contadores: Record<EstadoSuspension, number>;
  porRevisar: number;
}

export interface UsuarioRef {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

export interface MiAsignacion {
  id: string;
  tipo: TipoAsignacion;
  estado: EstadoAsignacion;
  instrucciones: string | null;
  telefonoContacto: string | null;
  fechaProgramada: string | null;
  asignadoPorNombre: string | null;
  resultado: ResultadoAsignacion | null;
  informeTrabajador: string | null;
  evidenciaUrl: string | null;
  iniciadaEn: string | null;
  devueltaEn: string | null;
  createdAt: string;
  cliente: {
    nombre: string;
    telefono: string | null;
    direccion: string | null;
    ip: string | null;
    plan: string | null;
    latitud: string | null;
    longitud: string | null;
  } | null;
  montoAdeudado: number | null;
}

export interface CrearSuspensionInput {
  clienteNombre: string;
  clienteTelefono?: string;
  clienteDireccion?: string;
  clienteIp?: string;
  clientePlan?: string;
  clienteLatitud?: string;
  clienteLongitud?: string;
  clienteOrigenId?: string;
  fechaSuspension: string;
  montoAdeudado: number;
  anuncio?: string;
}

export interface CambiarEstadoInput {
  estado: EstadoSuspension;
  nota?: string;
  acuerdoTexto?: string;
  acuerdoFechas?: FechaAcuerdo[];
  enviarAgenda?: boolean;
  recogerNota?: string;
  recogerFecha?: string;
  desconexionNota?: string;
  montoPendienteFinal?: number;
}

export interface AsignacionInput {
  tipo: TipoAsignacion;
  instrucciones?: string;
  telefonoContacto?: string;
  fechaProgramada?: string;
  trabajadorId: string;
}

export interface AgendaInput {
  fecha: string;
  hora?: string;
  tipo: TipoAgenda;
  titulo?: string;
  nota?: string;
  responsableId?: string;
}

export interface RevisarInput {
  revisionNota: string;
  cambiarEstado?: CambiarEstadoInput;
  agenda?: AgendaInput;
  reasignar?: AsignacionInput;
}

/** Quita las claves vacías para no mandar `?estado=` al backend. */
const clean = (params?: Record<string, string | undefined>) => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params ?? {})) if (v) out[k] = v;
  return out;
};

async function descargar(path: string, nombre: string, params?: Record<string, string | undefined>) {
  const res = await api.get(path, { params: clean(params), responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------ suspensiones

export const listarSuspensiones = (params: { estado?: string; q?: string; vista?: string; page?: number }) =>
  api
    .get<ListaSuspensiones>("/suspensiones", {
      params: clean({ ...params, page: params.page ? String(params.page) : undefined }),
    })
    .then((r) => r.data);

export const obtenerSuspension = (id: string) =>
  api.get<SuspensionDetalle>(`/suspensiones/${id}`).then((r) => r.data);

export const crearSuspension = (input: CrearSuspensionInput) =>
  api.post<Suspension>("/suspensiones", input).then((r) => r.data);

export const editarSuspension = (id: string, input: Partial<CrearSuspensionInput>) =>
  api.patch<Suspension>(`/suspensiones/${id}`, input).then((r) => r.data);

export const cambiarEstado = (id: string, input: CambiarEstadoInput) =>
  api.patch<SuspensionDetalle>(`/suspensiones/${id}/estado`, input).then((r) => r.data);

export const eliminarSuspension = (id: string, motivo: string) =>
  api.delete<{ deleted: boolean }>(`/suspensiones/${id}`, { data: { motivo } }).then((r) => r.data);

export const descargarLogTxt = (params?: { desde?: string; hasta?: string }) =>
  descargar("/suspensiones/log/export", "suspensiones-log.txt", params);

export const usuariosSuspensiones = () =>
  api.get<{ trabajadores: UsuarioRef[]; responsables: UsuarioRef[] }>("/suspensiones/usuarios").then((r) => r.data);

// ------------------------------------------------------------ asignaciones

export const asignar = (suspensionId: string, input: AsignacionInput) =>
  api.post<Asignacion>(`/suspensiones/${suspensionId}/asignaciones`, input).then((r) => r.data);

export const porRevisar = () =>
  api.get<(Asignacion & { suspension: Suspension | null })[]>("/suspensiones/por-revisar").then((r) => r.data);

export const revisarAsignacion = (id: string, input: RevisarInput) =>
  api.patch<Asignacion>(`/suspensiones/asignaciones/${id}/revisar`, input).then((r) => r.data);

export const misAsignaciones = () =>
  api.get<{ activas: MiAsignacion[]; recientes: MiAsignacion[] }>("/suspensiones/mis-asignaciones").then((r) => r.data);

export const iniciarAsignacion = (id: string) =>
  api.patch(`/suspensiones/asignaciones/${id}/iniciar`).then((r) => r.data);

export const completarAsignacion = (
  id: string,
  input: { resultado: ResultadoAsignacion; informe: string; evidencia?: File | null }
) => {
  const form = new FormData();
  form.append("resultado", input.resultado);
  form.append("informe", input.informe);
  if (input.evidencia) form.append("evidencia", input.evidencia);
  return api.patch(`/suspensiones/asignaciones/${id}/completar`, form).then((r) => r.data);
};

// ------------------------------------------------------------------ agenda

export const listarAgenda = (params: {
  desde?: string;
  hasta?: string;
  estado?: string;
  tipo?: string;
  responsableId?: string;
}) => api.get<AgendaEntrada[]>("/suspensiones/agenda", { params: clean(params) }).then((r) => r.data);

export const resumenAgenda = () =>
  api.get<{ fecha: string; hoy: number; vencidos: number }>("/suspensiones/agenda/resumen").then((r) => r.data);

export const crearAgenda = (input: AgendaInput & { suspensionId?: string }) =>
  api.post<AgendaEntrada>("/suspensiones/agenda", input).then((r) => r.data);

export const editarAgenda = (id: string, input: Partial<AgendaInput>) =>
  api.patch<AgendaEntrada>(`/suspensiones/agenda/${id}`, input).then((r) => r.data);

export const resolverAgenda = (id: string, estado: EstadoAgenda, nota?: string) =>
  api.patch<AgendaEntrada>(`/suspensiones/agenda/${id}/resolver`, { estado, nota }).then((r) => r.data);

export const eliminarAgenda = (id: string, motivo?: string) =>
  api.delete<{ deleted: boolean }>(`/suspensiones/agenda/${id}`, { data: { motivo } }).then((r) => r.data);

export const descargarIcs = (params?: { desde?: string; hasta?: string }) =>
  descargar("/suspensiones/agenda/ics", "agenda-suspensiones.ics", params);

// ----------------------------------------------------------------- formato

export const dinero = (n?: number | null) =>
  `Q${Number(n ?? 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fechaCorta = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export const fechaHora = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("es-GT") : "—");

/** Fecha local de hoy en formato AAAA-MM-DD. */
export const hoyISO = (offsetDias = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const errorMsg = (err: any, fallback = "Ocurrió un error") => {
  const m = err?.response?.data?.message;
  if (Array.isArray(m)) return m.join(". ");
  return m || fallback;
};
