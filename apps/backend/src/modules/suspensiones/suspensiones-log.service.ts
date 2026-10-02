import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import { DateTime } from "luxon";
import { dirname, isAbsolute, join } from "path";

export interface ActorLog {
  id: string | null;
  nombre: string | null;
  rol: string | null;
}

/** Una línea del log permanente. Nunca se edita ni se borra. */
export interface SuspensionLogEntry {
  fecha: string; // ISO
  accion: string;
  suspensionId: string | null;
  cliente: string | null;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  detalle?: string | null;
  datos?: unknown;
  usuario: ActorLog;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Log permanente de Suspensiones: un archivo JSONL (una línea por acción) fuera
 * de Postgres, en el mismo volumen persistente que el archivo de tareas.
 * Sólo se agregan líneas: aunque un registro se elimine de la base, su
 * historia completa queda aquí y se puede descargar como TXT.
 */
@Injectable()
export class SuspensionesLogService {
  private readonly logger = new Logger(SuspensionesLogService.name);
  private readonly filePath: string;
  private readonly tz: string;
  /** Serializa las escrituras: dos acciones simultáneas no deben entrelazarse. */
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly cfg: ConfigService) {
    this.tz = this.cfg.get<string>("BUSINESS_TZ") || "America/Guatemala";
    const dir =
      this.cfg.get<string>("SUSPENSIONES_LOG_DIR") ||
      this.cfg.get<string>("TASK_ARCHIVE_DIR") ||
      join(process.cwd(), "data");
    const base = isAbsolute(dir) ? dir : join(process.cwd(), dir);
    this.filePath = join(base, "suspensiones-log.jsonl");
  }

  /** Escribe la línea. Si falla, lanza: quien llama decide si aborta. */
  async append(entry: Omit<SuspensionLogEntry, "fecha"> & { fecha?: string }): Promise<void> {
    const line = JSON.stringify({ fecha: new Date().toISOString(), ...entry }) + "\n";
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        await fs.mkdir(dirname(this.filePath), { recursive: true });
        await fs.appendFile(this.filePath, line, "utf8");
      });
    await this.writeQueue;
  }

  /** Igual que `append`, pero un fallo sólo se reporta (la acción ya se guardó en la base). */
  async appendSafe(entry: Omit<SuspensionLogEntry, "fecha">): Promise<void> {
    try {
      await this.append(entry);
    } catch (err: any) {
      this.logger.error(`No se pudo escribir el log de suspensiones (${this.filePath}): ${err?.message ?? err}`);
    }
  }

  async readAll(): Promise<SuspensionLogEntry[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, "utf8");
    } catch (err: any) {
      if (err?.code === "ENOENT") return [];
      throw err;
    }
    const out: SuspensionLogEntry[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try {
        out.push(JSON.parse(t));
      } catch {
        this.logger.warn(`Línea ilegible en ${this.filePath}; se omite.`);
      }
    }
    return out;
  }

  async list(filters: { desde?: string; hasta?: string } = {}): Promise<SuspensionLogEntry[]> {
    const desde = DATE_ONLY.test(filters.desde || "") ? filters.desde : undefined;
    const hasta = DATE_ONLY.test(filters.hasta || "") ? filters.hasta : undefined;
    const all = await this.readAll();
    if (!desde && !hasta) return all;
    return all.filter((e) => {
      const day = DateTime.fromISO(e.fecha).setZone(this.tz).toISODate();
      if (!day) return false;
      if (desde && day < desde) return false;
      if (hasta && day > hasta) return false;
      return true;
    });
  }

  /** Versión legible (lo que se descarga como .txt), en orden cronológico. */
  toPlainText(entries: SuspensionLogEntry[]): string {
    const sep = "=".repeat(72);
    const head = [
      sep,
      "LOG DE SUSPENSIONES - InternetPerla",
      `Generado: ${this.format(new Date().toISOString())}`,
      `Registros: ${entries.length}`,
      sep,
      "",
    ];
    const body = entries.map((e) => {
      const lines = [
        `[${this.format(e.fecha)}] ${e.accion}`,
        `  Cliente...........: ${e.cliente || "-"}`,
        `  Suspensión ID.....: ${e.suspensionId || "-"}`,
        `  Usuario...........: ${e.usuario?.nombre || "-"} (${e.usuario?.rol || "-"})`,
      ];
      if (e.estadoAnterior || e.estadoNuevo) {
        lines.push(`  Estado............: ${e.estadoAnterior || "-"} -> ${e.estadoNuevo || "-"}`);
      }
      if (e.detalle) lines.push(`  Detalle...........: ${this.indent(e.detalle)}`);
      if (e.datos !== undefined && e.datos !== null) {
        lines.push(`  Datos.............:`);
        lines.push(this.indent(JSON.stringify(e.datos, null, 2), "    ", true));
      }
      lines.push("-".repeat(72));
      return lines.join("\n");
    });
    return [...head, ...body, ""].join("\n");
  }

  private indent(text: string, pad = "                      ", all = false) {
    const parts = String(text).split(/\r?\n/);
    return parts.map((p, i) => (i === 0 && !all ? p : pad + p)).join("\n");
  }

  private format(iso?: string | null) {
    if (!iso) return "-";
    const dt = DateTime.fromISO(iso).setZone(this.tz);
    return dt.isValid ? dt.toFormat("dd/LL/yyyy HH:mm") : iso;
  }
}
