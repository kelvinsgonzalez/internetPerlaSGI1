import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DateTime } from "luxon";
import cron from "node-cron";
import { Brackets, EntityManager, In, Not } from "typeorm";
import { isRetiredEmail } from "../../common/security";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { UsersRepository } from "../../repositories/users.repository";
import { isManager, Role } from "../users/user.entity";
import {
  AgendaEntradaDto,
  AgendaQuery,
  CambiarEstadoDto,
  CompletarAsignacionDto,
  CrearAgendaDto,
  CrearAsignacionDto,
  CreateSuspensionDto,
  EditarAgendaDto,
  EliminarAgendaDto,
  ListarQuery,
  ResolverAgendaDto,
  RevisarAsignacionDto,
  UpdateSuspensionDto,
} from "./dto";
import { agendaToIcs, TIPO_AGENDA_LABEL } from "./ics.util";
import {
  ESTADOS_SUSPENSION,
  FechaAcuerdo,
  OrigenAgenda,
  Suspension,
  SuspensionAgenda,
  SuspensionAsignacion,
  SuspensionEvento,
  TipoAgenda,
  TipoAsignacion,
} from "./suspension.model";
import { SuspensionesDatabase } from "./suspensiones.database";
import { SuspensionLogEntry, SuspensionesLogService } from "./suspensiones-log.service";

/** Lo que deja `req.user` la estrategia JWT. */
export interface Actor {
  userId: string;
  role: Role | string;
  name?: string | null;
  email?: string | null;
}

const PAGE_SIZE = 24;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const ESTADO_LABEL: Record<string, string> = {
  SUSPENDIDO: "Suspendido",
  REACTIVADO_ACUERDO: "Reactivado con acuerdo",
  RECOGER_EQUIPO: "Recoger equipo",
  DESCONEXION: "Desconexión",
};

const TIPO_ASIGNACION_LABEL: Record<TipoAsignacion, string> = {
  RECOGER_EQUIPO: "Recoger equipo",
  VISITA: "Visita",
};

type LogDraft = Omit<SuspensionLogEntry, "fecha" | "usuario">;

/** Efectos a ejecutar después del commit (log y avisos en tiempo real). */
interface AfterCommit {
  logs: LogDraft[];
  susp: Set<string>; // suspensiones modificadas -> "suspension:updated"
  asignaciones: SuspensionAsignacion[]; // creadas/modificadas -> aviso al trabajador
  agenda: boolean; // la agenda cambió -> "agenda:updated"
}

const nuevoAfter = (): AfterCommit => ({ logs: [], susp: new Set(), asignaciones: [], agenda: false });

const clean = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

@Injectable()
export class SuspensionesService implements OnModuleInit {
  private readonly logger = new Logger(SuspensionesService.name);
  private readonly tz: string;

  constructor(
    private readonly db: SuspensionesDatabase,
    private readonly log: SuspensionesLogService,
    private readonly rt: RealtimeGateway,
    private readonly users: UsersRepository,
    cfg: ConfigService
  ) {
    this.tz = cfg.get<string>("BUSINESS_TZ") || "America/Guatemala";
  }

  /** Recordatorio diario (07:00, hora del negocio) sólo para admin y supervisor. */
  onModuleInit() {
    cron.schedule(
      "0 7 * * *",
      () => {
        void this.enviarRecordatorioDiario();
      },
      { timezone: this.tz }
    );
  }

  async enviarRecordatorioDiario() {
    try {
      const resumen = await this.agendaResumen(true);
      if (resumen.hoy || resumen.vencidos) {
        this.rt.broadcastToAdmins("agenda:recordatorio", resumen);
      }
      return resumen;
    } catch (err: any) {
      this.logger.warn(`No se pudo enviar el recordatorio de agenda: ${err?.message ?? err}`);
      return null;
    }
  }

  // ---------------------------------------------------------------- helpers

  private hoy() {
    return DateTime.now().setZone(this.tz).toISODate()!;
  }

  private nombreActor(a: Actor) {
    return a.name || a.email || "Usuario";
  }

  private usuarioLog(a: Actor) {
    return { id: a.userId, nombre: this.nombreActor(a), rol: String(a.role) };
  }

  private dinero(n?: number | null) {
    const v = Number(n ?? 0);
    return `Q${v.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private fechaCorta(iso?: string | null) {
    if (!iso) return "-";
    const d = DateTime.fromISO(iso);
    return d.isValid ? d.toFormat("dd/LL/yyyy") : iso;
  }

  /** Enunciado por defecto que se anuncia al supervisor. */
  redactarAnuncio(d: {
    clienteNombre: string;
    clienteTelefono?: string | null;
    clienteDireccion?: string | null;
    clienteIp?: string | null;
    clientePlan?: string | null;
    fechaSuspension: string;
    montoAdeudado: number;
  }) {
    const datos = [
      d.clienteTelefono ? `tel. ${d.clienteTelefono}` : null,
      d.clienteDireccion ? d.clienteDireccion : null,
      d.clienteIp ? `IP ${d.clienteIp}` : null,
      d.clientePlan ? `plan ${d.clientePlan}` : null,
    ].filter(Boolean);
    return (
      `Se informa que el cliente ${d.clienteNombre.trim()}` +
      (datos.length ? ` (${datos.join(", ")})` : "") +
      ` fue SUSPENDIDO el ${this.fechaCorta(d.fechaSuspension)} con un saldo pendiente de ${this.dinero(d.montoAdeudado)}.`
    );
  }

  private evento(
    m: EntityManager,
    s: Suspension,
    actor: Actor,
    data: Partial<Pick<SuspensionEvento, "tipo" | "estadoAnterior" | "estadoNuevo" | "nota" | "datos">>
  ) {
    const repo = m.getRepository(SuspensionEvento);
    return repo.save(
      repo.create({
        suspensionId: s.id,
        tipo: data.tipo ?? "EDICION",
        estadoAnterior: data.estadoAnterior ?? null,
        estadoNuevo: data.estadoNuevo ?? null,
        nota: data.nota ?? null,
        datos: data.datos ?? null,
        usuarioId: actor.userId,
        usuarioNombre: this.nombreActor(actor),
        usuarioRol: String(actor.role),
      })
    );
  }

  /** Tras el commit: log permanente + avisos. Nunca revierte lo guardado. */
  private async despues(after: AfterCommit, actor: Actor) {
    for (const l of after.logs) {
      await this.log.appendSafe({ ...l, usuario: this.usuarioLog(actor) });
    }
    for (const id of after.susp) {
      this.rt.broadcastToAdmins("suspension:updated", { id });
    }
    for (const a of after.asignaciones) {
      this.rt.emitToUser(a.trabajadorId, "suspension-asignacion:updated", { id: a.id, estado: a.estado });
      this.rt.broadcastToAdmins("suspension-asignacion:updated", { id: a.id, estado: a.estado });
    }
    if (after.agenda) this.rt.broadcastToAdmins("agenda:updated", {});
  }

  private async buscarSuspension(m: EntityManager, id: string) {
    const s = await m.getRepository(Suspension).findOne({ where: { id } });
    if (!s) throw new NotFoundException("Suspensión no encontrada");
    return s;
  }

  private async usuarioActivo(id: string) {
    const u = await this.users.findById(id);
    if (!u || u.isBlocked || isRetiredEmail(u.email)) return null;
    return u;
  }

  private async trabajadorValido(id: string) {
    const u = await this.usuarioActivo(id);
    if (!u || u.role !== Role.USER) throw new BadRequestException("El trabajador seleccionado no es válido");
    return u;
  }

  private async responsableValido(id?: string | null) {
    if (!id) return null;
    const u = await this.usuarioActivo(id);
    if (!u || !isManager(u.role)) {
      throw new BadRequestException("El responsable de la agenda debe ser un administrador o supervisor");
    }
    return u;
  }

  // ------------------------------------------------------------- usuarios

  /** Trabajadores (para asignar) y admin/supervisores (responsables de agenda). */
  async usuarios() {
    const all = await this.users.findAll();
    const activos = all.filter((u) => !u.isBlocked && !isRetiredEmail(u.email));
    const map = (u: (typeof all)[number]) => ({ id: u.id, nombre: u.name || u.email, email: u.email, rol: u.role });
    const byName = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre);
    return {
      trabajadores: activos.filter((u) => u.role === Role.USER).map(map).sort(byName),
      responsables: activos.filter((u) => isManager(u.role)).map(map).sort(byName),
    };
  }

  // ---------------------------------------------------------- suspensiones

  async listar(q: ListarQuery) {
    const m = await this.db.manager();
    const page = Math.max(1, Number.parseInt(q.page || "1", 10) || 1);
    const qb = m.getRepository(Suspension).createQueryBuilder("s");

    if (q.estado && (ESTADOS_SUSPENSION as readonly string[]).includes(q.estado)) {
      qb.andWhere("s.estado = :estado", { estado: q.estado });
    } else if (q.vista === "activas") {
      qb.andWhere("s.estado <> 'DESCONEXION'");
    }
    const texto = (q.q || "").trim();
    if (texto) {
      const like = `%${texto.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where("s.cliente_nombre ILIKE :like", { like })
            .orWhere("s.cliente_telefono ILIKE :like", { like })
            .orWhere("s.cliente_ip ILIKE :like", { like })
            .orWhere("s.cliente_direccion ILIKE :like", { like });
        })
      );
    }
    if (q.desde && DATE_ONLY.test(q.desde)) qb.andWhere("s.fecha_suspension >= :desde", { desde: q.desde });
    if (q.hasta && DATE_ONLY.test(q.hasta)) qb.andWhere("s.fecha_suspension <= :hasta", { hasta: q.hasta });

    const [items, total] = await qb
      .orderBy("s.updated_at", "DESC")
      .skip((page - 1) * PAGE_SIZE)
      .take(PAGE_SIZE)
      .getManyAndCount();

    const ids = items.map((s) => s.id);
    const asignaciones = ids.length
      ? await m.getRepository(SuspensionAsignacion).find({
          where: { suspensionId: In(ids), estado: Not("CERRADA") },
          order: { createdAt: "DESC" },
        })
      : [];

    const conteo: { estado: string; total: string }[] = await m
      .getRepository(Suspension)
      .createQueryBuilder("s")
      .select("s.estado", "estado")
      .addSelect("COUNT(*)", "total")
      .groupBy("s.estado")
      .getRawMany();
    const contadores: Record<string, number> = Object.fromEntries(ESTADOS_SUSPENSION.map((e) => [e, 0]));
    for (const c of conteo) contadores[c.estado] = Number(c.total);

    const porRevisar = await m.getRepository(SuspensionAsignacion).count({ where: { estado: "DEVUELTA" } });

    return {
      items: items.map((s) => ({ ...s, asignaciones: asignaciones.filter((a) => a.suspensionId === s.id) })),
      total,
      page,
      pageSize: PAGE_SIZE,
      contadores,
      porRevisar,
    };
  }

  async obtener(id: string) {
    const m = await this.db.manager();
    const s = await this.buscarSuspension(m, id);
    const [asignaciones, agenda, eventos] = await Promise.all([
      m.getRepository(SuspensionAsignacion).find({ where: { suspensionId: id }, order: { createdAt: "DESC" } }),
      m.getRepository(SuspensionAgenda).find({ where: { suspensionId: id }, order: { fecha: "ASC", hora: "ASC" } }),
      m.getRepository(SuspensionEvento).find({ where: { suspensionId: id }, order: { createdAt: "ASC" } }),
    ]);
    return { ...s, asignaciones, agenda, eventos };
  }

  async crear(dto: CreateSuspensionDto, actor: Actor) {
    const datos = {
      clienteNombre: dto.clienteNombre.trim(),
      clienteTelefono: clean(dto.clienteTelefono),
      clienteDireccion: clean(dto.clienteDireccion),
      clienteIp: clean(dto.clienteIp),
      clientePlan: clean(dto.clientePlan),
      clienteLatitud: clean(dto.clienteLatitud),
      clienteLongitud: clean(dto.clienteLongitud),
      clienteOrigenId: clean(dto.clienteOrigenId),
      fechaSuspension: dto.fechaSuspension,
      montoAdeudado: dto.montoAdeudado,
    };
    const anuncio = clean(dto.anuncio) ?? this.redactarAnuncio(datos);

    const saved = await this.db.transaction(async (m) => {
      const repo = m.getRepository(Suspension);
      const s = await repo.save(
        repo.create({
          ...datos,
          anuncio,
          estado: "SUSPENDIDO",
          creadoPorId: actor.userId,
          creadoPorNombre: this.nombreActor(actor),
        })
      );
      await this.evento(m, s, actor, { tipo: "CREACION", estadoNuevo: "SUSPENDIDO", nota: anuncio });
      return s;
    });

    await this.log.appendSafe({
      accion: "CREACION",
      suspensionId: saved.id,
      cliente: saved.clienteNombre,
      estadoNuevo: "SUSPENDIDO",
      detalle: anuncio,
      datos: { ...datos },
      usuario: this.usuarioLog(actor),
    });
    this.rt.broadcastToAdmins("suspension:created", {
      id: saved.id,
      clienteNombre: saved.clienteNombre,
      anuncio: saved.anuncio,
      creadoPor: saved.creadoPorNombre,
    });
    return saved;
  }

  async editar(id: string, dto: UpdateSuspensionDto, actor: Actor) {
    const after = nuevoAfter();
    const result = await this.db.transaction(async (m) => {
      const s = await this.buscarSuspension(m, id);
      const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
      const campos: (keyof UpdateSuspensionDto)[] = [
        "clienteNombre",
        "clienteTelefono",
        "clienteDireccion",
        "clienteIp",
        "clientePlan",
        "clienteLatitud",
        "clienteLongitud",
        "fechaSuspension",
        "montoAdeudado",
        "anuncio",
      ];
      for (const campo of campos) {
        if (dto[campo] === undefined) continue;
        const nuevo =
          campo === "montoAdeudado" || campo === "fechaSuspension"
            ? dto[campo]
            : campo === "clienteNombre" || campo === "anuncio"
              ? String(dto[campo]).trim()
              : clean(dto[campo] as string);
        const actual = (s as any)[campo];
        if (String(actual ?? "") === String(nuevo ?? "")) continue;
        cambios[campo] = { antes: actual, despues: nuevo };
        (s as any)[campo] = nuevo;
      }
      if (!Object.keys(cambios).length) return s;
      const saved = await m.getRepository(Suspension).save(s);
      await this.evento(m, s, actor, { tipo: "EDICION", datos: { cambios } });
      after.logs.push({
        accion: "EDICION",
        suspensionId: s.id,
        cliente: s.clienteNombre,
        detalle: `Campos modificados: ${Object.keys(cambios).join(", ")}`,
        datos: cambios,
      });
      after.susp.add(s.id);
      return saved;
    });
    await this.despues(after, actor);
    return result;
  }

  /** Valida y aplica un cambio de estado dentro de una transacción. */
  private async aplicarEstado(m: EntityManager, s: Suspension, dto: CambiarEstadoDto, actor: Actor, after: AfterCommit) {
    const anterior = s.estado;
    const nota = clean(dto.nota);
    const detalle: string[] = [];
    const datos: Record<string, unknown> = {};

    switch (dto.estado) {
      case "REACTIVADO_ACUERDO": {
        const texto = clean(dto.acuerdoTexto);
        if (!texto) throw new BadRequestException("Escribe qué fue lo que se acordó");
        const fechas: FechaAcuerdo[] = (dto.acuerdoFechas ?? []).map((f) => ({
          fecha: f.fecha,
          monto: f.monto ?? null,
          nota: clean(f.nota),
        }));
        if (!fechas.length) throw new BadRequestException("Agrega al menos una fecha del acuerdo");
        fechas.sort((a, b) => a.fecha.localeCompare(b.fecha));
        s.acuerdoTexto = texto;
        s.acuerdoFechas = fechas;
        detalle.push(`Acuerdo: ${texto}`);
        detalle.push(
          "Fechas: " +
            fechas
              .map((f) => `${this.fechaCorta(f.fecha)}${f.monto != null ? ` ${this.dinero(f.monto)}` : ""}${f.nota ? ` (${f.nota})` : ""}`)
              .join("; ")
        );
        datos.acuerdoTexto = texto;
        datos.acuerdoFechas = fechas;
        break;
      }
      case "RECOGER_EQUIPO": {
        s.recogerNota = clean(dto.recogerNota) ?? s.recogerNota;
        s.recogerFecha = dto.recogerFecha ?? s.recogerFecha;
        if (s.recogerNota) detalle.push(`Nota: ${s.recogerNota}`);
        if (s.recogerFecha) detalle.push(`Fecha planificada: ${this.fechaCorta(s.recogerFecha)}`);
        datos.recogerNota = s.recogerNota;
        datos.recogerFecha = s.recogerFecha;
        break;
      }
      case "DESCONEXION": {
        const texto = clean(dto.desconexionNota);
        if (!texto) throw new BadRequestException("Escribe qué fue lo que pasó con la desconexión");
        if (dto.montoPendienteFinal === undefined || dto.montoPendienteFinal === null) {
          throw new BadRequestException("Indica cuánto quedó debiendo el cliente");
        }
        s.desconexionNota = texto;
        s.montoPendienteFinal = dto.montoPendienteFinal;
        detalle.push(`Qué pasó: ${texto}`);
        detalle.push(`Monto pendiente: ${this.dinero(dto.montoPendienteFinal)}`);
        datos.desconexionNota = texto;
        datos.montoPendienteFinal = dto.montoPendienteFinal;
        break;
      }
      case "SUSPENDIDO":
        break;
    }

    s.estado = dto.estado;
    await m.getRepository(Suspension).save(s);
    if (nota) detalle.unshift(nota);
    await this.evento(m, s, actor, {
      tipo: "CAMBIO_ESTADO",
      estadoAnterior: anterior,
      estadoNuevo: dto.estado,
      nota: detalle.join("\n") || null,
      datos,
    });
    after.logs.push({
      accion: anterior === dto.estado ? "ACTUALIZACION_ESTADO" : "CAMBIO_ESTADO",
      suspensionId: s.id,
      cliente: s.clienteNombre,
      estadoAnterior: anterior,
      estadoNuevo: dto.estado,
      detalle: detalle.join("\n") || null,
      datos,
    });
    after.susp.add(s.id);

    const enviar = dto.enviarAgenda !== false;
    if (dto.estado === "REACTIVADO_ACUERDO" && enviar) {
      await this.sincronizarAgendaAcuerdo(m, s, actor, after);
    }
    if (dto.estado === "RECOGER_EQUIPO" && dto.enviarAgenda && s.recogerFecha) {
      await this.crearEntradaAgenda(
        m,
        {
          fecha: s.recogerFecha,
          tipo: "RECOGER_EQUIPO",
          titulo: `Recoger equipo – ${s.clienteNombre}`,
          nota: s.recogerNota ?? undefined,
        },
        { suspension: s, origen: "MANUAL" },
        actor,
        after
      );
    }
  }

  async cambiarEstado(id: string, dto: CambiarEstadoDto, actor: Actor) {
    const after = nuevoAfter();
    await this.db.transaction(async (m) => {
      const s = await this.buscarSuspension(m, id);
      await this.aplicarEstado(m, s, dto, actor, after);
    });
    await this.despues(after, actor);
    return this.obtener(id);
  }

  /**
   * Cada fecha del acuerdo es un recordatorio COBRO_ACUERDO. Si el acuerdo se
   * edita, las entradas pendientes se actualizan y las que sobran se cancelan,
   * para que no queden recordatorios huérfanos.
   */
  private async sincronizarAgendaAcuerdo(m: EntityManager, s: Suspension, actor: Actor, after: AfterCommit) {
    const repo = m.getRepository(SuspensionAgenda);
    const existentes = await repo.find({
      where: { suspensionId: s.id, origen: "ACUERDO", estado: Not("CANCELADO") },
      order: { orden: "ASC" },
    });
    const fechas = s.acuerdoFechas ?? [];
    const cambios: string[] = [];

    for (let i = 0; i < fechas.length; i++) {
      const f = fechas[i];
      const titulo = `Cobro acuerdo – ${s.clienteNombre}${f.monto != null ? ` – ${this.dinero(f.monto)}` : ""}`;
      const nota = [f.nota, s.acuerdoTexto].filter(Boolean).join("\n") || null;
      const actual = existentes.find((e) => e.orden === i);
      if (actual) {
        if (actual.estado === "HECHO") continue;
        if (actual.fecha !== f.fecha || actual.titulo !== titulo || actual.nota !== nota) {
          actual.fecha = f.fecha;
          actual.titulo = titulo;
          actual.nota = nota;
          actual.clienteNombre = s.clienteNombre;
          await repo.save(actual);
          cambios.push(`actualizada ${this.fechaCorta(f.fecha)}`);
        }
      } else {
        await repo.save(
          repo.create({
            suspensionId: s.id,
            origen: "ACUERDO",
            orden: i,
            fecha: f.fecha,
            tipo: "COBRO_ACUERDO",
            titulo,
            nota,
            clienteNombre: s.clienteNombre,
            estado: "PENDIENTE",
            creadoPorId: actor.userId,
            creadoPorNombre: this.nombreActor(actor),
          })
        );
        cambios.push(`agendada ${this.fechaCorta(f.fecha)}`);
      }
    }
    for (const e of existentes) {
      if (e.estado !== "PENDIENTE" || (e.orden ?? 0) < fechas.length) continue;
      e.estado = "CANCELADO";
      e.resolucionNota = "El acuerdo se modificó y esta fecha ya no aplica";
      e.resueltoPorNombre = this.nombreActor(actor);
      e.resueltoEn = new Date();
      await repo.save(e);
      cambios.push(`cancelada ${this.fechaCorta(e.fecha)}`);
    }

    if (cambios.length) {
      await this.evento(m, s, actor, { tipo: "AGENDA_CREADA", nota: `Agenda del acuerdo: ${cambios.join(", ")}` });
      after.logs.push({
        accion: "AGENDA_ACUERDO",
        suspensionId: s.id,
        cliente: s.clienteNombre,
        detalle: `Agenda del acuerdo: ${cambios.join(", ")}`,
      });
      after.agenda = true;
    }
  }

  async eliminar(id: string, motivo: string, actor: Actor) {
    const detalle = await this.obtener(id);
    const motivoLimpio = motivo.trim();

    // Primero el log permanente con la copia completa; si no se puede
    // documentar, no se borra nada.
    try {
      await this.log.append({
        accion: "ELIMINACION",
        suspensionId: id,
        cliente: detalle.clienteNombre,
        estadoAnterior: detalle.estado,
        detalle: `Motivo: ${motivoLimpio}`,
        datos: detalle,
        usuario: this.usuarioLog(actor),
      });
    } catch (err: any) {
      this.logger.error(`No se pudo documentar la eliminación de ${id}: ${err?.message ?? err}`);
      throw new InternalServerErrorException("No se pudo documentar la eliminación en el log; el registro NO se eliminó");
    }

    await this.db.transaction(async (m) => {
      await m
        .getRepository(SuspensionAgenda)
        .createQueryBuilder()
        .update()
        .set({
          estado: "CANCELADO",
          resolucionNota: `Suspensión eliminada: ${motivoLimpio}`,
          resueltoPorNombre: this.nombreActor(actor),
          resueltoEn: () => "now()",
        })
        .where("suspension_id = :id AND estado = 'PENDIENTE'", { id })
        .execute();
      await m.getRepository(Suspension).delete({ id });
    });

    for (const a of detalle.asignaciones) {
      if (a.estado === "PENDIENTE" || a.estado === "EN_PROCESO") {
        this.rt.emitToUser(a.trabajadorId, "suspension-asignacion:updated", { id: a.id, deleted: true });
      }
    }
    this.rt.broadcastToAdmins("suspension:updated", { id, deleted: true });
    this.rt.broadcastToAdmins("agenda:updated", {});
    return { deleted: true };
  }

  async exportarLog(desde?: string, hasta?: string) {
    const entries = await this.log.list({ desde, hasta });
    return this.log.toPlainText(entries);
  }

  // ---------------------------------------------------------- asignaciones

  private async crearAsignacionInterna(
    m: EntityManager,
    s: Suspension,
    dto: {
      tipo: TipoAsignacion;
      instrucciones?: string;
      telefonoContacto?: string;
      fechaProgramada?: string;
      trabajadorId: string;
    },
    actor: Actor,
    after: AfterCommit
  ) {
    const trabajador = await this.trabajadorValido(dto.trabajadorId);
    const repo = m.getRepository(SuspensionAsignacion);
    const a = await repo.save(
      repo.create({
        suspensionId: s.id,
        tipo: dto.tipo,
        instrucciones: clean(dto.instrucciones),
        telefonoContacto: clean(dto.telefonoContacto) ?? s.clienteTelefono,
        fechaProgramada: dto.fechaProgramada ?? null,
        trabajadorId: trabajador.id,
        trabajadorNombre: trabajador.name || trabajador.email,
        asignadoPorId: actor.userId,
        asignadoPorNombre: this.nombreActor(actor),
        estado: "PENDIENTE",
      })
    );
    const tipoLabel = TIPO_ASIGNACION_LABEL[a.tipo];
    const detalle = [
      `${tipoLabel} asignada a ${a.trabajadorNombre}`,
      a.fechaProgramada ? `Fecha programada: ${this.fechaCorta(a.fechaProgramada)}` : null,
      a.instrucciones ? `Instrucciones: ${a.instrucciones}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    await this.evento(m, s, actor, {
      tipo: "ASIGNACION_CREADA",
      nota: detalle,
      datos: { asignacionId: a.id, tipo: a.tipo, trabajador: a.trabajadorNombre },
    });
    after.logs.push({ accion: "ASIGNACION_CREADA", suspensionId: s.id, cliente: s.clienteNombre, detalle, datos: a });
    after.asignaciones.push(a);
    after.susp.add(s.id);

    if (a.fechaProgramada) {
      await this.crearEntradaAgenda(
        m,
        {
          fecha: a.fechaProgramada,
          tipo: a.tipo,
          titulo: `${tipoLabel} – ${s.clienteNombre}`,
          nota: [`Trabajador: ${a.trabajadorNombre}`, a.instrucciones].filter(Boolean).join("\n"),
          responsableId: isManager(actor.role) ? actor.userId : undefined,
        },
        { suspension: s, origen: "ASIGNACION", asignacionId: a.id },
        actor,
        after
      );
    }
    return a;
  }

  async asignar(id: string, dto: CrearAsignacionDto, actor: Actor) {
    const after = nuevoAfter();
    const { a, cliente } = await this.db.transaction(async (m) => {
      const s = await this.buscarSuspension(m, id);
      return { a: await this.crearAsignacionInterna(m, s, dto, actor, after), cliente: s.clienteNombre };
    });
    await this.despues(after, actor);
    this.rt.emitToUser(a.trabajadorId, "suspension-asignacion:created", { id: a.id, tipo: a.tipo, cliente });
    return a;
  }

  async porRevisar() {
    const m = await this.db.manager();
    const asignaciones = await m.getRepository(SuspensionAsignacion).find({
      where: { estado: "DEVUELTA" },
      order: { devueltaEn: "ASC" },
    });
    const ids = [...new Set(asignaciones.map((a) => a.suspensionId))];
    const susp = ids.length ? await m.getRepository(Suspension).find({ where: { id: In(ids) } }) : [];
    return asignaciones.map((a) => ({ ...a, suspension: susp.find((s) => s.id === a.suspensionId) ?? null }));
  }

  /** Vista del trabajador: sólo sus asignaciones y los datos necesarios para ir. */
  async misAsignaciones(actor: Actor) {
    const m = await this.db.manager();
    const repo = m.getRepository(SuspensionAsignacion);
    const [activas, recientes] = await Promise.all([
      repo.find({
        where: { trabajadorId: actor.userId, estado: In(["PENDIENTE", "EN_PROCESO"]) },
        order: { fechaProgramada: "ASC", createdAt: "ASC" },
      }),
      repo.find({
        where: { trabajadorId: actor.userId, estado: In(["DEVUELTA", "CERRADA"]) },
        order: { devueltaEn: "DESC" },
        take: 20,
      }),
    ]);
    const all = [...activas, ...recientes];
    const ids = [...new Set(all.map((a) => a.suspensionId))];
    const susp = ids.length ? await m.getRepository(Suspension).find({ where: { id: In(ids) } }) : [];
    const vista = (a: SuspensionAsignacion) => {
      const s = susp.find((x) => x.id === a.suspensionId);
      return {
        id: a.id,
        tipo: a.tipo,
        estado: a.estado,
        instrucciones: a.instrucciones,
        telefonoContacto: a.telefonoContacto,
        fechaProgramada: a.fechaProgramada,
        asignadoPorNombre: a.asignadoPorNombre,
        resultado: a.resultado,
        informeTrabajador: a.informeTrabajador,
        evidenciaUrl: a.evidenciaUrl,
        iniciadaEn: a.iniciadaEn,
        devueltaEn: a.devueltaEn,
        createdAt: a.createdAt,
        cliente: s
          ? {
              nombre: s.clienteNombre,
              telefono: s.clienteTelefono,
              direccion: s.clienteDireccion,
              ip: s.clienteIp,
              plan: s.clientePlan,
              latitud: s.clienteLatitud,
              longitud: s.clienteLongitud,
            }
          : null,
        montoAdeudado: s?.montoAdeudado ?? null,
      };
    };
    return { activas: activas.map(vista), recientes: recientes.map(vista) };
  }

  private async asignacionPropia(m: EntityManager, id: string, actor: Actor) {
    const a = await m.getRepository(SuspensionAsignacion).findOne({ where: { id } });
    if (!a) throw new NotFoundException("Asignación no encontrada");
    if (a.trabajadorId !== actor.userId) throw new ForbiddenException("Esta asignación no es tuya");
    return a;
  }

  async iniciar(id: string, actor: Actor) {
    const after = nuevoAfter();
    const a = await this.db.transaction(async (m) => {
      const a = await this.asignacionPropia(m, id, actor);
      if (a.estado !== "PENDIENTE") throw new BadRequestException("Sólo se puede iniciar una asignación pendiente");
      a.estado = "EN_PROCESO";
      a.iniciadaEn = new Date();
      await m.getRepository(SuspensionAsignacion).save(a);
      const s = await this.buscarSuspension(m, a.suspensionId);
      const nota = `${this.nombreActor(actor)} inició la ${TIPO_ASIGNACION_LABEL[a.tipo].toLowerCase()}`;
      await this.evento(m, s, actor, { tipo: "ASIGNACION_INICIADA", nota, datos: { asignacionId: a.id } });
      after.logs.push({ accion: "ASIGNACION_INICIADA", suspensionId: s.id, cliente: s.clienteNombre, detalle: nota });
      after.asignaciones.push(a);
      after.susp.add(s.id);
      return a;
    });
    await this.despues(after, actor);
    return a;
  }

  /** El trabajador cuenta qué pasó y la asignación regresa al admin para revisión. */
  async completar(id: string, dto: CompletarAsignacionDto, evidenciaUrl: string | null, actor: Actor) {
    const after = nuevoAfter();
    let cliente = "";
    const a = await this.db.transaction(async (m) => {
      const a = await this.asignacionPropia(m, id, actor);
      if (a.estado !== "PENDIENTE" && a.estado !== "EN_PROCESO") {
        throw new BadRequestException("Esta asignación ya fue entregada");
      }
      a.estado = "DEVUELTA";
      a.resultado = dto.resultado;
      a.informeTrabajador = dto.informe.trim();
      a.evidenciaUrl = evidenciaUrl || null;
      a.iniciadaEn = a.iniciadaEn ?? new Date();
      a.devueltaEn = new Date();
      await m.getRepository(SuspensionAsignacion).save(a);

      // La entrada de agenda de esta visita ya se cumplió.
      const agendaRes = await m
        .getRepository(SuspensionAgenda)
        .createQueryBuilder()
        .update()
        .set({
          estado: "HECHO",
          resolucionNota: `Realizada por ${this.nombreActor(actor)}`,
          resueltoPorNombre: this.nombreActor(actor),
          resueltoEn: () => "now()",
        })
        .where("asignacion_id = :id AND estado = 'PENDIENTE'", { id: a.id })
        .execute();
      if (agendaRes.affected) after.agenda = true;

      const s = await this.buscarSuspension(m, a.suspensionId);
      cliente = s.clienteNombre;
      const detalle = [
        `${TIPO_ASIGNACION_LABEL[a.tipo]} devuelta por ${this.nombreActor(actor)}`,
        `Resultado: ${a.resultado}`,
        `Qué pasó: ${a.informeTrabajador}`,
        a.evidenciaUrl ? `Evidencia: ${a.evidenciaUrl}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      await this.evento(m, s, actor, {
        tipo: "ASIGNACION_DEVUELTA",
        nota: detalle,
        datos: { asignacionId: a.id, resultado: a.resultado, evidenciaUrl: a.evidenciaUrl },
      });
      after.logs.push({ accion: "ASIGNACION_DEVUELTA", suspensionId: s.id, cliente: s.clienteNombre, detalle });
      after.susp.add(s.id);
      return a;
    });
    await this.despues(after, actor);
    this.rt.broadcastToAdmins("suspension-asignacion:devuelta", {
      id: a.id,
      suspensionId: a.suspensionId,
      cliente,
      trabajador: a.trabajadorNombre,
      tipo: a.tipo,
    });
    return a;
  }

  /** Admin/supervisor revisa el informe y decide cómo continuar. */
  async revisar(id: string, dto: RevisarAsignacionDto, actor: Actor) {
    const after = nuevoAfter();
    const a = await this.db.transaction(async (m) => {
      const repo = m.getRepository(SuspensionAsignacion);
      const a = await repo.findOne({ where: { id } });
      if (!a) throw new NotFoundException("Asignación no encontrada");
      if (a.estado === "CERRADA") throw new BadRequestException("Esta asignación ya fue revisada");
      const estabaDevuelta = a.estado === "DEVUELTA";

      a.estado = "CERRADA";
      a.revisionNota = dto.revisionNota.trim();
      a.revisadoPorId = actor.userId;
      a.revisadoPorNombre = this.nombreActor(actor);
      a.cerradaEn = new Date();
      await repo.save(a);
      after.asignaciones.push(a);

      if (!estabaDevuelta) {
        // Se cerró sin que el trabajador la entregara: su recordatorio ya no aplica.
        const res = await m
          .getRepository(SuspensionAgenda)
          .createQueryBuilder()
          .update()
          .set({
            estado: "CANCELADO",
            resolucionNota: "Asignación cerrada sin realizarse",
            resueltoPorNombre: this.nombreActor(actor),
            resueltoEn: () => "now()",
          })
          .where("asignacion_id = :id AND estado = 'PENDIENTE'", { id: a.id })
          .execute();
        if (res.affected) after.agenda = true;
      }

      const s = await this.buscarSuspension(m, a.suspensionId);
      const detalle = [
        `${TIPO_ASIGNACION_LABEL[a.tipo]} de ${a.trabajadorNombre} revisada${estabaDevuelta ? "" : " (cerrada sin entrega del trabajador)"}`,
        `Nota de revisión: ${a.revisionNota}`,
      ].join("\n");
      await this.evento(m, s, actor, { tipo: "ASIGNACION_CERRADA", nota: detalle, datos: { asignacionId: a.id } });
      after.logs.push({ accion: "ASIGNACION_REVISADA", suspensionId: s.id, cliente: s.clienteNombre, detalle });
      after.susp.add(s.id);

      if (dto.cambiarEstado) await this.aplicarEstado(m, s, dto.cambiarEstado, actor, after);
      if (dto.agenda) {
        await this.crearEntradaAgenda(
          m,
          { ...dto.agenda, nota: dto.agenda.nota ?? a.revisionNota ?? undefined },
          { suspension: s, origen: "REVISION", asignacionId: a.id },
          actor,
          after
        );
      }
      if (dto.reasignar) await this.crearAsignacionInterna(m, s, dto.reasignar, actor, after);
      return a;
    });
    await this.despues(after, actor);
    return a;
  }

  // ---------------------------------------------------------------- agenda

  private async crearEntradaAgenda(
    m: EntityManager,
    dto: AgendaEntradaDto | (Omit<AgendaEntradaDto, "tipo"> & { tipo: TipoAgenda }),
    ctx: { suspension: Suspension | null; origen: OrigenAgenda; asignacionId?: string },
    actor: Actor,
    after: AfterCommit
  ) {
    const responsable = await this.responsableValido(dto.responsableId);
    const s = ctx.suspension;
    const titulo =
      clean(dto.titulo) ?? `${TIPO_AGENDA_LABEL[dto.tipo] ?? dto.tipo}${s ? ` – ${s.clienteNombre}` : ""}`;
    const repo = m.getRepository(SuspensionAgenda);
    const e = await repo.save(
      repo.create({
        suspensionId: s?.id ?? null,
        asignacionId: ctx.asignacionId ?? null,
        origen: ctx.origen,
        fecha: dto.fecha,
        hora: clean(dto.hora),
        tipo: dto.tipo,
        titulo,
        nota: clean(dto.nota),
        clienteNombre: s?.clienteNombre ?? null,
        responsableId: responsable?.id ?? null,
        responsableNombre: responsable ? responsable.name || responsable.email : null,
        estado: "PENDIENTE",
        creadoPorId: actor.userId,
        creadoPorNombre: this.nombreActor(actor),
      })
    );
    const detalle = `Agendado para ${this.fechaCorta(e.fecha)}${e.hora ? ` ${e.hora}` : ""}: ${e.titulo}${
      e.responsableNombre ? ` (responsable: ${e.responsableNombre})` : ""
    }`;
    if (s) await this.evento(m, s, actor, { tipo: "AGENDA_CREADA", nota: detalle, datos: { agendaId: e.id } });
    after.logs.push({
      accion: "AGENDA_CREADA",
      suspensionId: s?.id ?? null,
      cliente: s?.clienteNombre ?? null,
      detalle,
      datos: e,
    });
    after.agenda = true;
    if (s) after.susp.add(s.id);
    return e;
  }

  async agendaListar(q: AgendaQuery) {
    const m = await this.db.manager();
    const qb = m.getRepository(SuspensionAgenda).createQueryBuilder("a");
    if (q.desde && DATE_ONLY.test(q.desde)) qb.andWhere("a.fecha >= :desde", { desde: q.desde });
    if (q.hasta && DATE_ONLY.test(q.hasta)) qb.andWhere("a.fecha <= :hasta", { hasta: q.hasta });
    if (q.estado && ["PENDIENTE", "HECHO", "CANCELADO"].includes(q.estado)) {
      qb.andWhere("a.estado = :estado", { estado: q.estado });
    }
    if (q.tipo) qb.andWhere("a.tipo = :tipo", { tipo: q.tipo });
    if (q.responsableId === "sin") qb.andWhere("a.responsable_id IS NULL");
    else if (q.responsableId) qb.andWhere("a.responsable_id = :rid", { rid: q.responsableId });
    if (q.suspensionId) qb.andWhere("a.suspension_id = :sid", { sid: q.suspensionId });
    return qb
      .orderBy("a.fecha", "ASC")
      .addOrderBy("a.hora", "ASC", "NULLS FIRST")
      .addOrderBy("a.created_at", "ASC")
      .take(1000)
      .getMany();
  }

  /** Contadores para la campana: lo de hoy y lo vencido (pendiente). */
  async agendaResumen(conItems = false) {
    const m = await this.db.manager();
    const hoy = this.hoy();
    const repo = m.getRepository(SuspensionAgenda);
    const [deHoy, vencidos] = await Promise.all([
      repo.find({ where: { fecha: hoy, estado: "PENDIENTE" }, order: { hora: "ASC" } }),
      repo
        .createQueryBuilder("a")
        .where("a.estado = 'PENDIENTE' AND a.fecha < :hoy", { hoy })
        .orderBy("a.fecha", "ASC")
        .getMany(),
    ]);
    return {
      fecha: hoy,
      hoy: deHoy.length,
      vencidos: vencidos.length,
      ...(conItems ? { items: [...vencidos, ...deHoy].slice(0, 50) } : {}),
    };
  }

  async agendaIcs(desde?: string, hasta?: string) {
    const entries = await this.agendaListar({
      desde: desde && DATE_ONLY.test(desde) ? desde : DateTime.now().setZone(this.tz).minus({ days: 30 }).toISODate()!,
      hasta,
    });
    return agendaToIcs(
      entries.filter((e) => e.estado !== "CANCELADO"),
      this.tz
    );
  }

  async agendaCrear(dto: CrearAgendaDto, actor: Actor) {
    const after = nuevoAfter();
    const e = await this.db.transaction(async (m) => {
      const s = dto.suspensionId ? await this.buscarSuspension(m, dto.suspensionId) : null;
      return this.crearEntradaAgenda(m, dto, { suspension: s, origen: "MANUAL" }, actor, after);
    });
    await this.despues(after, actor);
    return e;
  }

  async agendaEditar(id: string, dto: EditarAgendaDto, actor: Actor) {
    const after = nuevoAfter();
    const e = await this.db.transaction(async (m) => {
      const repo = m.getRepository(SuspensionAgenda);
      const e = await repo.findOne({ where: { id } });
      if (!e) throw new NotFoundException("Entrada de agenda no encontrada");
      const antes = { ...e };
      if (dto.fecha) e.fecha = dto.fecha;
      if (dto.hora !== undefined) {
        const h = clean(dto.hora);
        if (h && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h)) throw new BadRequestException("La hora debe tener el formato HH:mm");
        e.hora = h;
      }
      if (dto.tipo) e.tipo = dto.tipo;
      if (dto.titulo) e.titulo = dto.titulo.trim();
      if (dto.nota !== undefined) e.nota = clean(dto.nota);
      if (dto.responsableId !== undefined) {
        const r = await this.responsableValido(clean(dto.responsableId));
        e.responsableId = r?.id ?? null;
        e.responsableNombre = r ? r.name || r.email : null;
      }
      await repo.save(e);
      const s = e.suspensionId ? await m.getRepository(Suspension).findOne({ where: { id: e.suspensionId } }) : null;
      const detalle = `Agenda editada: ${e.titulo} (${this.fechaCorta(antes.fecha)}${antes.hora ? ` ${antes.hora}` : ""} -> ${this.fechaCorta(e.fecha)}${e.hora ? ` ${e.hora}` : ""})`;
      if (s) {
        await this.evento(m, s, actor, { tipo: "AGENDA_EDITADA", nota: detalle, datos: { agendaId: e.id } });
        after.susp.add(s.id);
      }
      after.logs.push({
        accion: "AGENDA_EDITADA",
        suspensionId: e.suspensionId,
        cliente: e.clienteNombre,
        detalle,
        datos: { antes, despues: e },
      });
      after.agenda = true;
      return e;
    });
    await this.despues(after, actor);
    return e;
  }

  /** Borra un recordatorio. Primero queda documentado en el log permanente. */
  async agendaEliminar(id: string, dto: EliminarAgendaDto, actor: Actor) {
    const m = await this.db.manager();
    const e = await m.getRepository(SuspensionAgenda).findOne({ where: { id } });
    if (!e) throw new NotFoundException("Entrada de agenda no encontrada");
    const motivo = clean(dto.motivo);
    const detalle = `Recordatorio eliminado: ${e.titulo} (${this.fechaCorta(e.fecha)}${e.hora ? ` ${e.hora}` : ""}, ${e.estado})${
      motivo ? `\nMotivo: ${motivo}` : ""
    }`;

    try {
      await this.log.append({
        accion: "AGENDA_ELIMINADA",
        suspensionId: e.suspensionId,
        cliente: e.clienteNombre,
        detalle,
        datos: e,
        usuario: this.usuarioLog(actor),
      });
    } catch (err: any) {
      this.logger.error(`No se pudo documentar la eliminación de agenda ${id}: ${err?.message ?? err}`);
      throw new InternalServerErrorException("No se pudo documentar la eliminación en el log; el recordatorio NO se eliminó");
    }

    const after = nuevoAfter();
    await this.db.transaction(async (tm) => {
      await tm.getRepository(SuspensionAgenda).delete({ id });
      const s = e.suspensionId ? await tm.getRepository(Suspension).findOne({ where: { id: e.suspensionId } }) : null;
      if (s) {
        await this.evento(tm, s, actor, { tipo: "AGENDA_ELIMINADA", nota: detalle, datos: { agendaId: e.id } });
        after.susp.add(s.id);
      }
      after.agenda = true;
    });
    await this.despues(after, actor);
    return { deleted: true };
  }

  async agendaResolver(id: string, dto: ResolverAgendaDto, actor: Actor) {
    const after = nuevoAfter();
    const e = await this.db.transaction(async (m) => {
      const repo = m.getRepository(SuspensionAgenda);
      const e = await repo.findOne({ where: { id } });
      if (!e) throw new NotFoundException("Entrada de agenda no encontrada");
      const anterior = e.estado;
      e.estado = dto.estado;
      if (dto.estado === "PENDIENTE") {
        e.resolucionNota = null;
        e.resueltoPorNombre = null;
        e.resueltoEn = null;
      } else {
        e.resolucionNota = clean(dto.nota);
        e.resueltoPorNombre = this.nombreActor(actor);
        e.resueltoEn = new Date();
      }
      await repo.save(e);
      const s = e.suspensionId ? await m.getRepository(Suspension).findOne({ where: { id: e.suspensionId } }) : null;
      const detalle = `${e.titulo} (${this.fechaCorta(e.fecha)}): ${anterior} -> ${dto.estado}${
        e.resolucionNota ? `\nNota: ${e.resolucionNota}` : ""
      }`;
      if (s) {
        await this.evento(m, s, actor, { tipo: "AGENDA_RESUELTA", nota: detalle, datos: { agendaId: e.id } });
        after.susp.add(s.id);
      }
      after.logs.push({ accion: "AGENDA_RESUELTA", suspensionId: e.suspensionId, cliente: e.clienteNombre, detalle });
      after.agenda = true;
      return e;
    });
    await this.despues(after, actor);
    return e;
  }
}
