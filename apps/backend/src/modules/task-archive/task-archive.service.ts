import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import { DateTime } from "luxon";
import { dirname, isAbsolute, join } from "path";
import {
  ArchiveFilters,
  ArchivedRef,
  ArchivedTask,
} from "./task-archive.types";

interface FileCache {
  mtimeMs: number;
  size: number;
  records: ArchivedTask[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class TaskArchiveService {
  private readonly logger = new Logger(TaskArchiveService.name);
  private readonly filePath: string;
  private readonly tz: string;
  /** Serializa las escrituras: dos archivados simultaneos no deben entrelazarse. */
  private writeQueue: Promise<unknown> = Promise.resolve();
  private cache: FileCache | null = null;

  constructor(private readonly cfg: ConfigService) {
    this.tz = this.cfg.get<string>("BUSINESS_TZ") || "America/Guatemala";

    const explicitFile = this.cfg.get<string>("TASK_ARCHIVE_FILE");
    if (explicitFile) {
      this.filePath = isAbsolute(explicitFile)
        ? explicitFile
        : join(process.cwd(), explicitFile);
    } else {
      const dir =
        this.cfg.get<string>("TASK_ARCHIVE_DIR") || join(process.cwd(), "data");
      const base = isAbsolute(dir) ? dir : join(process.cwd(), dir);
      this.filePath = join(base, "tareas-archivadas.jsonl");
    }
  }

  getFilePath() {
    return this.filePath;
  }

  /** Agrega una tarea al archivo. Devuelve el registro tal cual quedo escrito. */
  async append(record: ArchivedTask): Promise<ArchivedTask> {
    const line = JSON.stringify(record) + "\n";
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        await fs.mkdir(dirname(this.filePath), { recursive: true });
        await fs.appendFile(this.filePath, line, "utf8");
        // La proxima lectura tiene que releer el archivo.
        this.cache = null;
      });
    await this.writeQueue;
    return record;
  }

  /** Lee el archivo completo. Las lineas corruptas se ignoran, no rompen la vista. */
  async readAll(): Promise<ArchivedTask[]> {
    let stat: { mtimeMs: number; size: number };
    try {
      const s = await fs.stat(this.filePath);
      stat = { mtimeMs: s.mtimeMs, size: s.size };
    } catch (err: any) {
      if (err?.code === "ENOENT") return [];
      throw err;
    }

    if (
      this.cache &&
      this.cache.mtimeMs === stat.mtimeMs &&
      this.cache.size === stat.size
    ) {
      return this.cache.records;
    }

    const raw = await fs.readFile(this.filePath, "utf8");
    const records: ArchivedTask[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as ArchivedTask;
        if (parsed && typeof parsed.id === "string") records.push(parsed);
      } catch {
        this.logger.warn(
          `Linea ilegible en ${this.filePath}; se omite del listado.`
        );
      }
    }

    this.cache = { ...stat, records };
    return records;
  }

  async readRaw(): Promise<string> {
    try {
      return await fs.readFile(this.filePath, "utf8");
    } catch (err: any) {
      if (err?.code === "ENOENT") return "";
      throw err;
    }
  }

  async isArchived(taskId: string): Promise<boolean> {
    const all = await this.readAll();
    return all.some((r) => r.id === taskId);
  }

  /** Listado filtrado, de lo mas reciente archivado a lo mas antiguo. */
  async list(filters: ArchiveFilters = {}): Promise<ArchivedTask[]> {
    const all = await this.readAll();
    const desde = DATE_ONLY.test(filters.desde || "") ? filters.desde : undefined;
    const hasta = DATE_ONLY.test(filters.hasta || "") ? filters.hasta : undefined;

    const filtered = all.filter((r) => {
      if (filters.clienteId && r.cliente?.id !== filters.clienteId) return false;
      if (filters.trabajadorId && r.trabajador?.id !== filters.trabajadorId)
        return false;
      if (desde || hasta) {
        const day = this.businessDay(r.creadaEn || r.archivadaEn);
        if (!day) return false;
        if (desde && day < desde) return false;
        if (hasta && day > hasta) return false;
      }
      return true;
    });

    return filtered.sort((a, b) =>
      (b.archivadaEn || "").localeCompare(a.archivadaEn || "")
    );
  }

  /**
   * Clientes y trabajadores presentes en el archivo. Los selectores se arman
   * con esto y no con la base: una tarea archivada de un cliente ya borrado
   * tiene que seguir siendo filtrable.
   */
  async options(): Promise<{ clientes: ArchivedRef[]; trabajadores: ArchivedRef[] }> {
    const all = await this.readAll();
    const clientes = new Map<string, ArchivedRef>();
    const trabajadores = new Map<string, ArchivedRef>();

    for (const r of all) {
      if (r.cliente?.id && !clientes.has(r.cliente.id)) {
        clientes.set(r.cliente.id, {
          id: r.cliente.id,
          nombre: r.cliente.nombre,
        });
      }
      if (r.trabajador?.id && !trabajadores.has(r.trabajador.id)) {
        trabajadores.set(r.trabajador.id, {
          id: r.trabajador.id,
          nombre: r.trabajador.nombre,
          email: r.trabajador.email ?? null,
        });
      }
    }

    const byName = (a: ArchivedRef, b: ArchivedRef) =>
      (a.nombre || a.email || "").localeCompare(b.nombre || b.email || "");

    return {
      clientes: [...clientes.values()].sort(byName),
      trabajadores: [...trabajadores.values()].sort(byName),
    };
  }

  /** Version legible del archivo (lo que se descarga como .txt). */
  toPlainText(records: ArchivedTask[]): string {
    const sep = "=".repeat(72);
    const head = [
      sep,
      "ARCHIVO DE TAREAS - InternetPerla",
      `Generado: ${this.format(new Date().toISOString())}`,
      `Registros: ${records.length}`,
      sep,
      "",
    ];

    const body = records.map((r) =>
      [
        `TAREA: ${r.titulo || "(sin titulo)"}`,
        `  ID................: ${r.id}`,
        `  Estado............: ${r.estado}`,
        `  Cliente...........: ${r.cliente?.nombre || "-"}`,
        `  Direccion.........: ${r.cliente?.direccion || "-"}`,
        `  Telefono cliente..: ${r.cliente?.telefono || "-"}`,
        `  Telefono contacto.: ${r.telefonoContacto || "-"}`,
        `  IP asignada.......: ${r.cliente?.ipAsignada || "-"}`,
        `  Trabajador........: ${r.trabajador?.nombre || r.trabajador?.email || "-"}`,
        `  Creada por........: ${r.creadaPor?.nombre || r.creadaPor?.email || "-"}`,
        `  Creada en.........: ${this.format(r.creadaEn)}`,
        `  Completada en.....: ${this.format(r.completadaEn)}`,
        `  Archivada en......: ${this.format(r.archivadaEn)}`,
        `  Archivada por.....: ${r.archivadaPor?.nombre || r.archivadaPor?.email || "-"}`,
        `  Descripcion.......: ${this.oneLine(r.descripcion)}`,
        `  Comentario final..: ${this.oneLine(r.comentarioFinal)}`,
        `  Evidencia.........: ${r.evidenciaUrl || "-"}`,
        "-".repeat(72),
      ].join("\n")
    );

    return [...head, ...body, ""].join("\n");
  }

  /** Dia (YYYY-MM-DD) en la zona horaria del negocio. */
  private businessDay(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const dt = DateTime.fromISO(iso, { setZone: true });
    if (!dt.isValid) return null;
    return dt.setZone(this.tz).toISODate();
  }

  private format(iso: string | null | undefined): string {
    if (!iso) return "-";
    const dt = DateTime.fromISO(iso, { setZone: true });
    if (!dt.isValid) return iso;
    return dt.setZone(this.tz).toFormat("yyyy-LL-dd HH:mm");
  }

  private oneLine(text: string | null | undefined): string {
    if (!text) return "-";
    return text.replace(/\s*\n\s*/g, " / ").trim() || "-";
  }
}
