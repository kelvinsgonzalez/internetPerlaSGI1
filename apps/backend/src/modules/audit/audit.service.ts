import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { AuditLog } from "./audit-log.entity";

export type AuditActor = {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export type AuditEntry = {
  actor?: AuditActor | null;
  action: string;
  module: string;
  method: string;
  path: string;
  entityId?: string | null;
  statusCode?: number | null;
  success?: boolean;
  ip?: string | null;
  userAgent?: string | null;
  details?: unknown;
  error?: string | null;
};

export type AuditQuery = {
  desde?: string;
  hasta?: string;
  userId?: string;
  module?: string;
  action?: string;
  success?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

/** Claves cuyo valor nunca se guarda en la bitácora. */
const SECRET_KEY = /pass(word)?|token|secret|hash|authorization|cookie/i;
const MAX_STRING = 500;
const MAX_ARRAY = 20;
const MAX_DETAILS_BYTES = 8_000;

/**
 * Copia el cuerpo de la petición quitando secretos y recortando lo voluminoso
 * (la importación del historial manda miles de filas en un solo POST).
 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 5) return "[…]";
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((v) => sanitize(v, depth + 1));
    if (value.length > MAX_ARRAY) items.push(`… ${value.length - MAX_ARRAY} elementos más`);
    return items;
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? "[oculto]" : sanitize(v, depth + 1);
  }
  return out;
}

function boundedDetails(details: unknown): Record<string, unknown> | null {
  if (details === undefined || details === null) return null;
  const clean = sanitize(details);
  const json = JSON.stringify(clean);
  if (json === undefined || json === "{}") return null;
  if (json.length > MAX_DETAILS_BYTES) {
    return { _recortado: true, vista: json.slice(0, MAX_DETAILS_BYTES) };
  }
  return typeof clean === "object" && !Array.isArray(clean)
    ? (clean as Record<string, unknown>)
    : { valor: clean };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");

  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /**
   * Nunca lanza: un fallo al escribir la bitácora no debe tumbar la acción
   * del usuario, que ya se ejecutó.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const actor = entry.actor ?? {};
      await this.repo.insert({
        userId: actor.userId ?? null,
        userEmail: actor.email ?? null,
        userName: actor.name ?? null,
        userRole: actor.role ?? null,
        action: entry.action,
        module: entry.module.slice(0, 64),
        method: entry.method.slice(0, 8),
        path: entry.path.slice(0, 512),
        entityId: entry.entityId ? String(entry.entityId).slice(0, 128) : null,
        statusCode: entry.statusCode ?? null,
        success: entry.success ?? true,
        ip: entry.ip ? entry.ip.slice(0, 64) : null,
        userAgent: entry.userAgent ? entry.userAgent.slice(0, 512) : null,
        details: boundedDetails(entry.details) as any,
        error: entry.error ? entry.error.slice(0, 1000) : null,
      });
    } catch (err) {
      this.logger.error(`No se pudo registrar la auditoría: ${(err as Error).message}`);
    }
  }

  private buildQuery(q: AuditQuery) {
    const qb = this.repo.createQueryBuilder("a");
    // Las fechas llegan como YYYY-MM-DD y se interpretan como días completos.
    if (q.desde) qb.andWhere("a.createdAt >= :desde", { desde: `${q.desde}T00:00:00` });
    if (q.hasta) qb.andWhere("a.createdAt < (:hasta::date + interval '1 day')", { hasta: q.hasta });
    if (q.userId) qb.andWhere("a.userId = :userId", { userId: q.userId });
    if (q.module) qb.andWhere("a.module = :module", { module: q.module });
    if (q.action) qb.andWhere("a.action = :action", { action: q.action });
    if (q.success === "true" || q.success === "false") {
      qb.andWhere("a.success = :success", { success: q.success === "true" });
    }
    if (q.q?.trim()) {
      const term = `%${q.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where("LOWER(a.path) LIKE :term", { term })
            .orWhere("LOWER(COALESCE(a.userEmail, '')) LIKE :term", { term })
            .orWhere("LOWER(COALESCE(a.userName, '')) LIKE :term", { term })
            .orWhere("LOWER(COALESCE(a.entityId, '')) LIKE :term", { term })
            .orWhere("LOWER(CAST(a.details AS text)) LIKE :term", { term });
        })
      );
    }
    return qb.orderBy("a.createdAt", "DESC");
  }

  async list(q: AuditQuery) {
    const pageSize = Math.min(Math.max(Number(q.pageSize) || 50, 1), 200);
    const page = Math.max(Number(q.page) || 1, 1);
    const [items, total] = await this.buildQuery(q)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** Valores distintos para poblar los filtros de la pantalla. */
  async options() {
    const modules = await this.repo
      .createQueryBuilder("a")
      .select("DISTINCT a.module", "module")
      .orderBy("module")
      .getRawMany<{ module: string }>();
    const users = await this.repo
      .createQueryBuilder("a")
      .select("a.userId", "id")
      .addSelect("MAX(a.userEmail)", "email")
      .addSelect("MAX(a.userName)", "name")
      .where("a.userId IS NOT NULL")
      .groupBy("a.userId")
      .orderBy("email")
      .getRawMany<{ id: string; email: string; name: string | null }>();
    return { modules: modules.map((m) => m.module), users };
  }

  /** Exporta hasta 10 000 filas filtradas como CSV (abre en Excel). */
  async toCsv(q: AuditQuery) {
    const rows = await this.buildQuery(q).take(10_000).getMany();
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = [
      "fecha", "usuario", "correo", "rol", "accion", "modulo", "metodo",
      "ruta", "registro", "estado", "exito", "ip", "detalles", "error",
    ];
    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(), r.userName, r.userEmail, r.userRole, r.action,
        r.module, r.method, r.path, r.entityId, r.statusCode, r.success ? "si" : "no",
        r.ip, r.details, r.error,
      ].map(esc).join(",")
    );
    // BOM para que Excel reconozca UTF-8 (acentos).
    return "﻿" + [header.join(","), ...lines].join("\r\n");
  }

  /** Borra registros más viejos que `days` días. */
  async purgeOlderThan(days: number) {
    const res = await this.repo
      .createQueryBuilder()
      .delete()
      .where("createdAt < now() - (:days || ' days')::interval", { days: String(days) })
      .execute();
    return res.affected ?? 0;
  }
}
