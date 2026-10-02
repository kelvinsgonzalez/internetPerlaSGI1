import { Plus, Trash2 } from "lucide-react";
import {
  ESTADO_LABEL,
  ESTADOS,
  TIPO_AGENDA_LABEL,
  TIPO_ASIGNACION_LABEL,
  type AgendaInput,
  type AsignacionInput,
  type CambiarEstadoInput,
  type EstadoSuspension,
  type FechaAcuerdo,
  type Suspension,
  type TipoAgenda,
  type TipoAsignacion,
  type UsuarioRef,
} from "../../services/suspensiones";
import { inputCls, labelCls } from "./Modal";

/* Formularios reutilizables: se usan sueltos (cambiar estado, asignar, agendar)
 * y combinados dentro de la revisión de una asignación devuelta. */

// ------------------------------------------------------------------ estado

export function estadoInicial(s: Suspension, estado?: EstadoSuspension): CambiarEstadoInput {
  return {
    estado: estado ?? s.estado,
    nota: "",
    acuerdoTexto: s.acuerdoTexto ?? "",
    acuerdoFechas: s.acuerdoFechas?.length ? s.acuerdoFechas.map((f) => ({ ...f })) : [{ fecha: "", monto: null, nota: "" }],
    enviarAgenda: true,
    recogerNota: s.recogerNota ?? "",
    recogerFecha: s.recogerFecha ?? "",
    desconexionNota: s.desconexionNota ?? "",
    montoPendienteFinal: s.montoPendienteFinal ?? s.montoAdeudado,
  };
}

/** Error de validación en el cliente (el servidor valida lo mismo). */
export function validarEstado(v: CambiarEstadoInput): string | null {
  if (v.estado === "REACTIVADO_ACUERDO") {
    if (!v.acuerdoTexto?.trim()) return "Escribe qué fue lo que se acordó";
    const fechas = (v.acuerdoFechas ?? []).filter((f) => f.fecha);
    if (!fechas.length) return "Agrega al menos una fecha del acuerdo";
  }
  if (v.estado === "DESCONEXION") {
    if (!v.desconexionNota?.trim()) return "Escribe qué fue lo que pasó";
    if (v.montoPendienteFinal === undefined || v.montoPendienteFinal === null || Number.isNaN(v.montoPendienteFinal))
      return "Indica cuánto quedó debiendo";
  }
  return null;
}

/** Limpia el formulario antes de enviarlo: sólo los campos del estado elegido. */
export function payloadEstado(v: CambiarEstadoInput): CambiarEstadoInput {
  const out: CambiarEstadoInput = { estado: v.estado, nota: v.nota?.trim() || undefined };
  if (v.estado === "REACTIVADO_ACUERDO") {
    out.acuerdoTexto = v.acuerdoTexto?.trim();
    out.acuerdoFechas = (v.acuerdoFechas ?? [])
      .filter((f) => f.fecha)
      .map((f) => ({
        fecha: f.fecha,
        monto: f.monto === null || f.monto === undefined || Number.isNaN(Number(f.monto)) ? null : Number(f.monto),
        nota: f.nota?.trim() || null,
      }));
    out.enviarAgenda = v.enviarAgenda;
  }
  if (v.estado === "RECOGER_EQUIPO") {
    out.recogerNota = v.recogerNota?.trim() || undefined;
    out.recogerFecha = v.recogerFecha || undefined;
    out.enviarAgenda = Boolean(v.enviarAgenda && v.recogerFecha);
  }
  if (v.estado === "DESCONEXION") {
    out.desconexionNota = v.desconexionNota?.trim();
    out.montoPendienteFinal = Number(v.montoPendienteFinal);
  }
  return out;
}

export function EstadoForm({
  value,
  onChange,
  disabled,
}: {
  value: CambiarEstadoInput;
  onChange: (v: CambiarEstadoInput) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<CambiarEstadoInput>) => onChange({ ...value, ...patch });
  const fechas = value.acuerdoFechas ?? [];
  const setFecha = (i: number, patch: Partial<FechaAcuerdo>) =>
    set({ acuerdoFechas: fechas.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  return (
    <div className="space-y-4">
      <div>
        <span className={labelCls}>Nuevo estado</span>
        <div className="grid grid-cols-2 gap-2">
          {ESTADOS.map((e) => (
            <button
              type="button"
              key={e}
              disabled={disabled}
              onClick={() => set({ estado: e })}
              className={`rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition ${
                value.estado === e
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {ESTADO_LABEL[e]}
            </button>
          ))}
        </div>
      </div>

      {value.estado === "REACTIVADO_ACUERDO" && (
        <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <div>
            <label className={labelCls}>¿Qué se acordó? *</label>
            <textarea
              className={inputCls}
              rows={3}
              value={value.acuerdoTexto ?? ""}
              disabled={disabled}
              onChange={(e) => set({ acuerdoTexto: e.target.value })}
              placeholder="Ej. Se reactiva el servicio; abona Q150 el 15 y cancela el resto a fin de mes."
            />
          </div>
          <div>
            <span className={labelCls}>Fechas del acuerdo *</span>
            <div className="space-y-2">
              {fechas.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    className={`${inputCls} !w-40`}
                    value={f.fecha}
                    disabled={disabled}
                    onChange={(e) => setFecha(i, { fecha: e.target.value })}
                    aria-label="Fecha"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${inputCls} !w-28`}
                    placeholder="Monto Q"
                    value={f.monto ?? ""}
                    disabled={disabled}
                    onChange={(e) => setFecha(i, { monto: e.target.value === "" ? null : Number(e.target.value) })}
                    aria-label="Monto"
                  />
                  <input
                    className={`${inputCls} min-w-[8rem] flex-1`}
                    placeholder="Nota (opcional)"
                    value={f.nota ?? ""}
                    disabled={disabled}
                    onChange={(e) => setFecha(i, { nota: e.target.value })}
                    aria-label="Nota"
                  />
                  <button
                    type="button"
                    disabled={disabled || fechas.length === 1}
                    onClick={() => set({ acuerdoFechas: fechas.filter((_, j) => j !== i) })}
                    className="rounded-full p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                    aria-label="Quitar fecha"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => set({ acuerdoFechas: [...fechas, { fecha: "", monto: null, nota: "" }] })}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar fecha
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={value.enviarAgenda !== false}
              disabled={disabled}
              onChange={(e) => set({ enviarAgenda: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            Enviar las fechas a la agenda como recordatorios
          </label>
        </div>
      )}

      {value.estado === "RECOGER_EQUIPO" && (
        <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
          <div>
            <label className={labelCls}>Nota de la recolección</label>
            <textarea
              className={inputCls}
              rows={2}
              value={value.recogerNota ?? ""}
              disabled={disabled}
              onChange={(e) => set({ recogerNota: e.target.value })}
              placeholder="Equipo a recoger, horario del cliente, etc."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Fecha planificada</label>
              <input
                type="date"
                className={inputCls}
                value={value.recogerFecha ?? ""}
                disabled={disabled}
                onChange={(e) => set({ recogerFecha: e.target.value })}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(value.enviarAgenda)}
                disabled={disabled || !value.recogerFecha}
                onChange={(e) => set({ enviarAgenda: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              Enviar a la agenda
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Para mandar a un trabajador, usa después “Asignar a trabajador”.
          </p>
        </div>
      )}

      {value.estado === "DESCONEXION" && (
        <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
          <div>
            <label className={labelCls}>¿Qué pasó? *</label>
            <textarea
              className={inputCls}
              rows={3}
              value={value.desconexionNota ?? ""}
              disabled={disabled}
              onChange={(e) => set({ desconexionNota: e.target.value })}
              placeholder="Motivo de la desconexión y cómo terminó la relación."
            />
          </div>
          <div>
            <label className={labelCls}>Monto que quedó debiendo (Q) *</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputCls}
              value={value.montoPendienteFinal ?? ""}
              disabled={disabled}
              onChange={(e) =>
                set({ montoPendienteFinal: e.target.value === "" ? (undefined as any) : Number(e.target.value) })
              }
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Comentario (opcional)</label>
        <input
          className={inputCls}
          value={value.nota ?? ""}
          disabled={disabled}
          onChange={(e) => set({ nota: e.target.value })}
          placeholder="Queda en la línea de tiempo"
        />
      </div>
    </div>
  );
}

// -------------------------------------------------------------- asignación

export type AsignacionDraft = AsignacionInput;

export const asignacionInicial = (s: Suspension, tipo: TipoAsignacion = "RECOGER_EQUIPO"): AsignacionDraft => ({
  tipo,
  instrucciones: "",
  telefonoContacto: s.clienteTelefono ?? "",
  fechaProgramada: "",
  trabajadorId: "",
});

export function payloadAsignacion(v: AsignacionDraft): AsignacionInput {
  return {
    tipo: v.tipo,
    instrucciones: v.instrucciones?.trim() || undefined,
    telefonoContacto: v.telefonoContacto?.trim() || undefined,
    fechaProgramada: v.fechaProgramada || undefined,
    trabajadorId: v.trabajadorId,
  };
}

/** Paso 1: tipo + instrucciones. */
export function AsignacionPaso1({
  value,
  onChange,
}: {
  value: AsignacionDraft;
  onChange: (v: AsignacionDraft) => void;
}) {
  const set = (patch: Partial<AsignacionDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div>
        <span className={labelCls}>¿Qué debe hacer el trabajador? *</span>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TIPO_ASIGNACION_LABEL) as TipoAsignacion[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => set({ tipo: t })}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                value.tipo === t
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {TIPO_ASIGNACION_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Instrucciones</label>
        <textarea
          className={inputCls}
          rows={3}
          value={value.instrucciones ?? ""}
          onChange={(e) => set({ instrucciones: e.target.value })}
          placeholder={
            value.tipo === "RECOGER_EQUIPO"
              ? "Equipo a recoger (router, antena, cables...), referencia de la casa, etc."
              : "Motivo de la visita: cobrar, proponer acuerdo, verificar, etc."
          }
        />
      </div>
      <div>
        <label className={labelCls}>Teléfono de contacto</label>
        <input
          className={inputCls}
          value={value.telefonoContacto ?? ""}
          onChange={(e) => set({ telefonoContacto: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Paso 2: fecha programada + trabajador. */
export function AsignacionPaso2({
  value,
  onChange,
  trabajadores,
}: {
  value: AsignacionDraft;
  onChange: (v: AsignacionDraft) => void;
  trabajadores: UsuarioRef[];
}) {
  const set = (patch: Partial<AsignacionDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Fecha programada (se agrega a la agenda)</label>
        <input
          type="date"
          className={inputCls}
          value={value.fechaProgramada ?? ""}
          onChange={(e) => set({ fechaProgramada: e.target.value })}
        />
      </div>
      <div>
        <label className={labelCls}>Trabajador *</label>
        <select className={inputCls} value={value.trabajadorId} onChange={(e) => set({ trabajadorId: e.target.value })}>
          <option value="">Selecciona un trabajador…</option>
          {trabajadores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
        {!trabajadores.length && <p className="mt-1 text-xs text-amber-600">No hay trabajadores activos.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ agenda

export const agendaInicial = (tipo: TipoAgenda = "SEGUIMIENTO"): AgendaInput => ({
  fecha: "",
  hora: "",
  tipo,
  titulo: "",
  nota: "",
  responsableId: "",
});

export function payloadAgenda(v: AgendaInput): AgendaInput {
  return {
    fecha: v.fecha,
    hora: v.hora || undefined,
    tipo: v.tipo,
    titulo: v.titulo?.trim() || undefined,
    nota: v.nota?.trim() || undefined,
    responsableId: v.responsableId || undefined,
  };
}

export function AgendaForm({
  value,
  onChange,
  responsables,
  tituloPlaceholder,
}: {
  value: AgendaInput;
  onChange: (v: AgendaInput) => void;
  responsables: UsuarioRef[];
  tituloPlaceholder?: string;
}) {
  const set = (patch: Partial<AgendaInput>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={labelCls}>Fecha *</label>
        <input type="date" className={inputCls} value={value.fecha} onChange={(e) => set({ fecha: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Hora (opcional)</label>
        <input type="time" className={inputCls} value={value.hora ?? ""} onChange={(e) => set({ hora: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Tipo</label>
        <select className={inputCls} value={value.tipo} onChange={(e) => set({ tipo: e.target.value as TipoAgenda })}>
          {(Object.keys(TIPO_AGENDA_LABEL) as TipoAgenda[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_AGENDA_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Responsable</label>
        <select
          className={inputCls}
          value={value.responsableId ?? ""}
          onChange={(e) => set({ responsableId: e.target.value })}
        >
          <option value="">Admin y supervisor (todos)</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Título</label>
        <input
          className={inputCls}
          value={value.titulo ?? ""}
          onChange={(e) => set({ titulo: e.target.value })}
          placeholder={tituloPlaceholder ?? "Se genera solo si lo dejas vacío"}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Nota</label>
        <textarea className={inputCls} rows={2} value={value.nota ?? ""} onChange={(e) => set({ nota: e.target.value })} />
      </div>
    </div>
  );
}
