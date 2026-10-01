import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { In } from "typeorm";
import { COBRO_FIELDS, CobroField, CobroHistorico } from "./cobro-historico.model";
import { CreateCobroDto, ImportCobrosDto, UpdateCobroDto } from "./dto";
import { HistorialDatabase } from "./historial.database";

// `cliente` llega validado como obligatorio; el resto puede ser null.
type CobroData = Partial<Record<CobroField, string | null>>;

const MAX_RESULTADOS = 100;
const LOTE = 500;

/** Minúsculas y sin acentos, para buscar "maria" y encontrar "María". */
const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Encabezado del archivo (normalizado, sin espacios ni _) → campo. */
const HEADER_MAP: Record<string, CobroField> = {
  id: "extId",
  extid: "extId",
  cliente: "cliente",
  ubicacion: "ubicacion",
  concepto: "concepto",
  fecha: "fecha",
  mesescancelados: "mesesCancelados",
  cantidadmesespagados: "cantidadMeses",
  cantidadmeses: "cantidadMeses",
  total: "total",
  comentarios: "formaPago",
  formadepago: "formaPago",
  formapago: "formaPago",
  cobrador: "cobrador",
  codigo: "codigo",
};

const normKey = (k: string) => norm(k).replace(/[\s_\-.]/g, "");

/** Texto tal cual (sólo sin espacios en los extremos); vacío → null. */
const asText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/**
 * Clave para ORDENAR por fecha sin tocar el texto guardado. Acepta
 * `d/m/aaaa [h:mm[:ss]]` (formato del archivo de origen), `d/m/aa` (año de dos
 * dígitos = 20aa) y `aaaa-mm-dd...`. Debe coincidir con la columna
 * generada `fecha_orden` (migración AddFechaOrden).
 */
function fechaKey(f: string | null): string | null {
  if (!f) return null;
  const pad = (n: string | undefined) => (n ?? "0").padStart(2, "0");
  let m = f.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${pad(m[2])}-${pad(m[1])} ${pad(m[4])}:${pad(m[5])}:${pad(m[6])}`;
  }
  m = f.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${pad(m[4])}:${pad(m[5])}:${pad(m[6])}`;
  return null;
}

/** Más antiguo primero; las fechas que no se entienden, al final. */
const porFecha = (a: CobroHistorico, b: CobroHistorico) => {
  const ka = fechaKey(a.fecha);
  const kb = fechaKey(b.fecha);
  if (ka && kb) return ka < kb ? -1 : ka > kb ? 1 : 0;
  if (ka) return -1;
  if (kb) return 1;
  return 0;
};

export type TodosQuery = {
  orden?: string;
  desde?: string;
  hasta?: string;
  /** Nombre exacto, elegido de las sugerencias. */
  cliente?: string;
  page?: string | number;
  pageSize?: string | number;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Rango máximo por consulta de fechas: 7 días contando ambos extremos. */
export const MAX_DIAS_RANGO = 7;

const DIA_MS = 86_400_000;
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS);

/**
 * Nombre sin acentos y en minúsculas, calculado en SQL. Debe ser idéntico a la
 * expresión de los índices de trigramas (migración AddBusquedaNombreIndex) para
 * que Postgres los use.
 */
const NOMBRE_NORMALIZADO = (col: string) =>
  `lower(translate(${col}, 'áàäâéèëêíìïîóòöôúùüûñÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ', 'aaaaeeeeiiiioooouuuunAAAAEEEEIIIIOOOOUUUUN'))`;
const MAX_SUGERENCIAS = 10;
/** Escapa % y _ para que el texto escrito se busque literal en LIKE. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const claveContenido = (r: CobroData) =>
  [norm(r.cliente), r.fecha ?? "", r.codigo ?? "", r.total ?? ""].join("|");

@Injectable()
export class HistorialService {
  constructor(private readonly db: HistorialDatabase) {}

  private pick(dto: UpdateCobroDto): CobroData {
    const data: CobroData = {};
    for (const f of COBRO_FIELDS) {
      if (f in dto) data[f] = asText((dto as any)[f]);
    }
    return data;
  }

  /** Clientes cuyo nombre o algún código contiene `q`. */
  async buscar(q: string) {
    const term = norm(q);
    if (term.length < 2) return [];
    const repo = await this.db.cobros();
    const grupos: { cliente: string; ubicacion: string | null; registros: string; codigos: string[] | null }[] =
      await repo.query(`
        SELECT cliente,
               min(ubicacion) AS ubicacion,
               count(*) AS registros,
               array_remove(array_agg(DISTINCT codigo), NULL) AS codigos
          FROM cobros
         GROUP BY cliente
      `);
    return grupos
      .filter((g) => norm(g.cliente).includes(term) || (g.codigos ?? []).some((c) => norm(c).includes(term)))
      .sort((a, b) => a.cliente.localeCompare(b.cliente, "es"))
      .slice(0, MAX_RESULTADOS)
      .map((g) => ({ ...g, registros: Number(g.registros), codigos: g.codigos ?? [] }));
  }

  /** Todos los pagos de un cliente (nombre exacto). */
  async ficha(cliente: string) {
    const repo = await this.db.cobros();
    const registros = (await repo.find({ where: { cliente } })).sort(porFecha);
    return {
      cliente,
      registros,
      resumen: { registros: registros.length, ultimo: registros[registros.length - 1] ?? null },
    };
  }

  /**
   * Listado del ADMIN, siempre acotado para no recorrer toda la tabla:
   * - por fecha del documento (`desde`/`hasta`, máx. 7 días), usando el índice
   *   sobre `fecha_orden`;
   * - o por un cliente exacto (`cliente`, elegido de las sugerencias), en
   *   todas las fechas y paginado; usa el índice de `cliente`.
   * Los dos criterios se pueden combinar.
   */
  async todos(query: TodosQuery) {
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 50, 1), 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const dir = query.orden === "asc" ? "ASC" : "DESC";
    const cliente = query.cliente?.trim() ?? "";
    const { desde, hasta } = query;

    const where: string[] = [];
    const params: unknown[] = [];

    if (desde || hasta) {
      if (!desde || !hasta || !FECHA_ISO.test(desde) || !FECHA_ISO.test(hasta)) {
        throw new BadRequestException("Indica las dos fechas (desde y hasta) en formato aaaa-mm-dd");
      }
      const dias = diasEntre(desde, hasta);
      if (Number.isNaN(dias) || dias < 0) {
        throw new BadRequestException("La fecha 'desde' debe ser anterior o igual a 'hasta'");
      }
      if (dias + 1 > MAX_DIAS_RANGO) {
        throw new BadRequestException(`El rango no puede pasar de ${MAX_DIAS_RANGO} días`);
      }
      // "hasta" incluye todo ese día: "aaaa-mm-dd 99" es mayor que cualquier hora.
      params.push(desde, `${hasta} 99`);
      where.push(`fecha_orden >= $1 AND fecha_orden < $2`);
    } else if (!cliente) {
      throw new BadRequestException(`Indica un rango de fechas (máx. ${MAX_DIAS_RANGO} días) o un cliente`);
    }

    if (cliente) {
      params.push(cliente);
      where.push(`cliente = $${params.length}`);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const repo = await this.db.cobros();
    const [{ total }] = await repo.query(`SELECT count(*)::int AS total FROM cobros ${whereSql}`, params);
    const rows: any[] = await repo.query(
      `SELECT id, ext_id, cliente, ubicacion, concepto, fecha, meses_cancelados,
              cantidad_meses, total, forma_pago, cobrador, codigo, fecha_orden
         FROM cobros ${whereSql}
        ORDER BY fecha_orden ${dir} NULLS LAST, cliente ASC, created_at ASC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params
    );
    const items = rows.map((r) => ({
      id: r.id,
      extId: r.ext_id,
      cliente: r.cliente,
      ubicacion: r.ubicacion,
      concepto: r.concepto,
      fecha: r.fecha,
      mesesCancelados: r.meses_cancelados,
      cantidadMeses: r.cantidad_meses,
      total: r.total,
      formaPago: r.forma_pago,
      cobrador: r.cobrador,
      codigo: r.codigo,
      fechaReconocida: r.fecha_orden !== null,
    }));
    return { items, total, page, pageSize };
  }

  /**
   * Hasta 10 nombres de cliente que contienen `q` en el nombre o en algún
   * código, sin distinguir acentos ni mayúsculas. Sólo nombres: los registros
   * se piden después, cuando el usuario confirma uno.
   */
  async sugerencias(q: string) {
    const term = norm(q);
    if (term.length < 2) return [];
    const repo = await this.db.cobros();
    const patron = `%${escapeLike(term)}%`;
    const prefijo = `${escapeLike(term)}%`;
    const rows: { cliente: string; ubicacion: string | null; registros: number; codigos: string[] | null }[] =
      await repo.query(
        `SELECT cliente,
                min(ubicacion) AS ubicacion,
                count(*)::int AS registros,
                array_remove(array_agg(DISTINCT codigo), NULL) AS codigos
           FROM cobros
          WHERE ${NOMBRE_NORMALIZADO("cliente")} LIKE $1
             OR ${NOMBRE_NORMALIZADO("codigo")} LIKE $1
          GROUP BY cliente
          -- Primero los que EMPIEZAN con lo escrito, luego alfabético.
          ORDER BY bool_or(${NOMBRE_NORMALIZADO("cliente")} LIKE $2) DESC, cliente
          LIMIT ${MAX_SUGERENCIAS}`,
        [patron, prefijo]
      );
    return rows.map((r) => ({ ...r, codigos: r.codigos ?? [] }));
  }

  async crear(dto: CreateCobroDto) {
    const repo = await this.db.cobros();
    return repo.save(repo.create(this.pick(dto) as Partial<CobroHistorico>));
  }

  async actualizar(id: string, dto: UpdateCobroDto) {
    const repo = await this.db.cobros();
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Registro no encontrado");
    Object.assign(row, this.pick(dto));
    if (!row.cliente) throw new BadRequestException("El cliente es obligatorio");
    return repo.save(row);
  }

  /**
   * Borra TODOS los registros del historial (para "refrescar" la base y
   * reimportar). TRUNCATE es instantáneo aunque haya miles de filas y deja
   * los índices limpios. Devuelve cuántos registros había.
   */
  async borrarTodo() {
    let borrados = 0;
    await this.db.transaction(async (tx) => {
      // LOCK evita que entre una importación entre el conteo y el vaciado.
      await tx.query(`LOCK TABLE cobros IN ACCESS EXCLUSIVE MODE`);
      const [{ total }] = await tx.query(`SELECT count(*)::int AS total FROM cobros`);
      borrados = total;
      await tx.query(`TRUNCATE TABLE cobros`);
    });
    return { borrados };
  }

  async eliminar(id: string) {
    const repo = await this.db.cobros();
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Registro no encontrado");
    await repo.remove(row);
    return { deleted: true };
  }

  /** Normaliza una fila cruda del archivo a los campos del historial. */
  private normalizarFila(raw: Record<string, unknown>): CobroData {
    const data: CobroData = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      const field = HEADER_MAP[normKey(k)];
      if (field && data[field] == null) data[field] = asText(v);
    }
    return data;
  }

  /**
   * Importación en dos pasos: con `preview` sólo analiza (inválidos y
   * duplicados); sin él inserta todo menos `omitir` y los inválidos.
   * Duplicado: mismo Id (si la fila lo trae) o, si no, mismo
   * cliente+fecha+código+total, contra la base y dentro del propio archivo.
   */
  async importar(dto: ImportCobrosDto) {
    const filas = (dto.registros ?? []).map((r) => this.normalizarFila(r));
    const repo = await this.db.cobros();

    const extIds = [...new Set(filas.map((f) => f.extId).filter((x): x is string => !!x))];
    const existentesId = new Set<string>();
    for (let i = 0; i < extIds.length; i += LOTE) {
      const rows = await repo.find({ select: { extId: true }, where: { extId: In(extIds.slice(i, i + LOTE)) } });
      rows.forEach((r) => r.extId && existentesId.add(r.extId));
    }

    const clientes = [...new Set(filas.filter((f) => !f.extId && f.cliente).map((f) => f.cliente as string))];
    const existentesContenido = new Set<string>();
    for (let i = 0; i < clientes.length; i += LOTE) {
      const rows = await repo.find({
        select: { cliente: true, fecha: true, codigo: true, total: true },
        where: { cliente: In(clientes.slice(i, i + LOTE)) },
      });
      rows.forEach((r) => existentesContenido.add(claveContenido(r)));
    }

    const vistosId = new Set<string>();
    const vistosContenido = new Set<string>();
    const analisis = filas.map((f, indice) => {
      let estado: "ok" | "invalido" | "duplicado" = "ok";
      if (!f.cliente) estado = "invalido";
      else if (f.extId) {
        if (existentesId.has(f.extId) || vistosId.has(f.extId)) estado = "duplicado";
        vistosId.add(f.extId);
      } else {
        const k = claveContenido(f);
        if (existentesContenido.has(k) || vistosContenido.has(k)) estado = "duplicado";
        vistosContenido.add(k);
      }
      return { indice, estado, datos: f };
    });

    const resumen = {
      total: analisis.length,
      validos: analisis.filter((a) => a.estado === "ok").length,
      duplicados: analisis.filter((a) => a.estado === "duplicado").length,
      invalidos: analisis.filter((a) => a.estado === "invalido").length,
    };

    if (dto.preview) return { preview: true, resumen, filas: analisis };

    const omitir = new Set(dto.omitir ?? []);
    const aInsertar = analisis.filter((a) => a.estado !== "invalido" && !omitir.has(a.indice)).map((a) => a.datos);

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < aInsertar.length; i += LOTE) {
        await tx.insert(aInsertar.slice(i, i + LOTE) as Partial<CobroHistorico>[]);
      }
    });
    return { insertados: aInsertar.length, omitidos: analisis.length - aInsertar.length };
  }
}
