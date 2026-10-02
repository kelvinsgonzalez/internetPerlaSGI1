import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { decimalTransformer } from "../../common/decimal.transformer";

/**
 * Modelos de la base `internetperla_suspensiones`.
 *
 * El archivo se llama `.model.ts` (no `.entity.ts`) a propósito: el glob de
 * entidades de la base principal no debe recogerlo, porque vive en otra base.
 * Nada aquí tiene FK hacia clientes ni usuarios: se guardan COPIAS (nombre,
 * teléfono, etc.) para que el seguimiento sobreviva a borrados y reimportaciones.
 */

export const ESTADOS_SUSPENSION = ["SUSPENDIDO", "REACTIVADO_ACUERDO", "RECOGER_EQUIPO", "DESCONEXION"] as const;
export type EstadoSuspension = (typeof ESTADOS_SUSPENSION)[number];

export const TIPOS_ASIGNACION = ["RECOGER_EQUIPO", "VISITA"] as const;
export type TipoAsignacion = (typeof TIPOS_ASIGNACION)[number];

export const ESTADOS_ASIGNACION = ["PENDIENTE", "EN_PROCESO", "DEVUELTA", "CERRADA"] as const;
export type EstadoAsignacion = (typeof ESTADOS_ASIGNACION)[number];

export const RESULTADOS_ASIGNACION = [
  "EQUIPO_RECOGIDO",
  "CLIENTE_PAGO",
  "CLIENTE_ACORDO",
  "NO_ENCONTRADO",
  "SE_NEGO",
  "OTRO",
] as const;
export type ResultadoAsignacion = (typeof RESULTADOS_ASIGNACION)[number];

export const TIPOS_AGENDA = ["COBRO_ACUERDO", "VISITA", "RECOGER_EQUIPO", "SEGUIMIENTO", "OTRO"] as const;
export type TipoAgenda = (typeof TIPOS_AGENDA)[number];

export const ESTADOS_AGENDA = ["PENDIENTE", "HECHO", "CANCELADO"] as const;
export type EstadoAgenda = (typeof ESTADOS_AGENDA)[number];

/** De dónde salió una entrada de agenda (para sincronizar las automáticas). */
export type OrigenAgenda = "ACUERDO" | "ASIGNACION" | "REVISION" | "MANUAL";

export interface FechaAcuerdo {
  fecha: string; // YYYY-MM-DD
  monto?: number | null;
  nota?: string | null;
}

@Entity({ name: "suspensiones" })
export class Suspension {
  @PrimaryGeneratedColumn("uuid") id: string;

  @Column({ name: "cliente_nombre", type: "text" }) clienteNombre: string;
  @Column({ name: "cliente_telefono", type: "text", nullable: true }) clienteTelefono: string | null;
  @Column({ name: "cliente_direccion", type: "text", nullable: true }) clienteDireccion: string | null;
  @Column({ name: "cliente_ip", type: "text", nullable: true }) clienteIp: string | null;
  @Column({ name: "cliente_plan", type: "text", nullable: true }) clientePlan: string | null;
  @Column({ name: "cliente_latitud", type: "text", nullable: true }) clienteLatitud: string | null;
  @Column({ name: "cliente_longitud", type: "text", nullable: true }) clienteLongitud: string | null;
  /** Id del cliente en el módulo Clientes al momento de crear. Sólo informativo. */
  @Column({ name: "cliente_origen_id", type: "text", nullable: true }) clienteOrigenId: string | null;

  @Column({ name: "fecha_suspension", type: "date" }) fechaSuspension: string;
  @Column({ name: "monto_adeudado", type: "numeric", precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  montoAdeudado: number;

  @Column({ type: "text" }) anuncio: string;
  @Column({ type: "text", default: "SUSPENDIDO" }) estado: EstadoSuspension;

  @Column({ name: "acuerdo_texto", type: "text", nullable: true }) acuerdoTexto: string | null;
  @Column({ name: "acuerdo_fechas", type: "jsonb", nullable: true }) acuerdoFechas: FechaAcuerdo[] | null;
  @Column({ name: "recoger_nota", type: "text", nullable: true }) recogerNota: string | null;
  @Column({ name: "recoger_fecha", type: "date", nullable: true }) recogerFecha: string | null;
  @Column({ name: "desconexion_nota", type: "text", nullable: true }) desconexionNota: string | null;
  @Column({
    name: "monto_pendiente_final",
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  montoPendienteFinal: number | null;

  @Column({ name: "creado_por_id", type: "text", nullable: true }) creadoPorId: string | null;
  @Column({ name: "creado_por_nombre", type: "text", nullable: true }) creadoPorNombre: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt: Date;
}

@Entity({ name: "suspension_asignaciones" })
export class SuspensionAsignacion {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "suspension_id", type: "uuid" }) suspensionId: string;

  @Column({ type: "text" }) tipo: TipoAsignacion;
  @Column({ type: "text", nullable: true }) instrucciones: string | null;
  @Column({ name: "telefono_contacto", type: "text", nullable: true }) telefonoContacto: string | null;
  @Column({ name: "fecha_programada", type: "date", nullable: true }) fechaProgramada: string | null;

  @Column({ name: "trabajador_id", type: "text" }) trabajadorId: string;
  @Column({ name: "trabajador_nombre", type: "text", nullable: true }) trabajadorNombre: string | null;
  @Column({ name: "asignado_por_id", type: "text", nullable: true }) asignadoPorId: string | null;
  @Column({ name: "asignado_por_nombre", type: "text", nullable: true }) asignadoPorNombre: string | null;

  @Column({ type: "text", default: "PENDIENTE" }) estado: EstadoAsignacion;
  @Column({ type: "text", nullable: true }) resultado: ResultadoAsignacion | null;
  @Column({ name: "informe_trabajador", type: "text", nullable: true }) informeTrabajador: string | null;
  @Column({ name: "evidencia_url", type: "text", nullable: true }) evidenciaUrl: string | null;
  @Column({ name: "iniciada_en", type: "timestamptz", nullable: true }) iniciadaEn: Date | null;
  @Column({ name: "devuelta_en", type: "timestamptz", nullable: true }) devueltaEn: Date | null;

  @Column({ name: "revision_nota", type: "text", nullable: true }) revisionNota: string | null;
  @Column({ name: "revisado_por_id", type: "text", nullable: true }) revisadoPorId: string | null;
  @Column({ name: "revisado_por_nombre", type: "text", nullable: true }) revisadoPorNombre: string | null;
  @Column({ name: "cerrada_en", type: "timestamptz", nullable: true }) cerradaEn: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt: Date;
}

@Entity({ name: "suspension_agenda" })
export class SuspensionAgenda {
  @PrimaryGeneratedColumn("uuid") id: string;
  /** Null si la suspensión se eliminó: la entrada se conserva (cancelada). */
  @Column({ name: "suspension_id", type: "uuid", nullable: true }) suspensionId: string | null;
  @Column({ name: "asignacion_id", type: "uuid", nullable: true }) asignacionId: string | null;
  @Column({ type: "text", default: "MANUAL" }) origen: OrigenAgenda;
  /** Posición dentro de las fechas del acuerdo (sólo origen ACUERDO). */
  @Column({ type: "int", nullable: true }) orden: number | null;

  @Column({ type: "date" }) fecha: string;
  @Column({ type: "text", nullable: true }) hora: string | null; // HH:mm
  @Column({ type: "text" }) tipo: TipoAgenda;
  @Column({ type: "text" }) titulo: string;
  @Column({ type: "text", nullable: true }) nota: string | null;
  @Column({ name: "cliente_nombre", type: "text", nullable: true }) clienteNombre: string | null;

  @Column({ name: "responsable_id", type: "text", nullable: true }) responsableId: string | null;
  @Column({ name: "responsable_nombre", type: "text", nullable: true }) responsableNombre: string | null;

  @Column({ type: "text", default: "PENDIENTE" }) estado: EstadoAgenda;
  @Column({ name: "resolucion_nota", type: "text", nullable: true }) resolucionNota: string | null;
  @Column({ name: "resuelto_por_nombre", type: "text", nullable: true }) resueltoPorNombre: string | null;
  @Column({ name: "resuelto_en", type: "timestamptz", nullable: true }) resueltoEn: Date | null;

  @Column({ name: "creado_por_id", type: "text", nullable: true }) creadoPorId: string | null;
  @Column({ name: "creado_por_nombre", type: "text", nullable: true }) creadoPorNombre: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt: Date;
}

@Entity({ name: "suspension_eventos" })
export class SuspensionEvento {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "suspension_id", type: "uuid" }) suspensionId: string;
  @Column({ type: "text" }) tipo: string;
  @Column({ name: "estado_anterior", type: "text", nullable: true }) estadoAnterior: string | null;
  @Column({ name: "estado_nuevo", type: "text", nullable: true }) estadoNuevo: string | null;
  @Column({ type: "text", nullable: true }) nota: string | null;
  @Column({ type: "jsonb", nullable: true }) datos: Record<string, unknown> | null;
  @Column({ name: "usuario_id", type: "text", nullable: true }) usuarioId: string | null;
  @Column({ name: "usuario_nombre", type: "text", nullable: true }) usuarioNombre: string | null;
  @Column({ name: "usuario_rol", type: "text", nullable: true }) usuarioRol: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt: Date;
}

export const SUSPENSIONES_MODELS = [Suspension, SuspensionAsignacion, SuspensionAgenda, SuspensionEvento];
