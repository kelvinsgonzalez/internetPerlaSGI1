import api from "./api";

/** Todos los datos son texto tal cual vienen del archivo de origen. */
export type CobroHistorico = {
  id: string;
  extId: string | null;
  cliente: string;
  ubicacion: string | null;
  concepto: string | null;
  fecha: string | null;
  mesesCancelados: string | null;
  cantidadMeses: string | null;
  total: string | null;
  formaPago: string | null;
  cobrador: string | null;
  codigo: string | null;
};

export type CobroInput = Partial<Omit<CobroHistorico, "id">> & { cliente: string };

export type ClienteResultado = {
  cliente: string;
  ubicacion: string | null;
  registros: number;
  codigos: string[];
};

export type Ficha = {
  cliente: string;
  registros: CobroHistorico[];
  resumen: { registros: number; ultimo: CobroHistorico | null };
};

export type FilaImport = {
  indice: number;
  estado: "ok" | "duplicado" | "invalido";
  datos: Partial<CobroInput>;
};

export type ImportPreview = {
  preview: true;
  resumen: { total: number; validos: number; duplicados: number; invalidos: number };
  filas: FilaImport[];
};

/** Columnas visibles, en el orden de la tabla y del CSV descargado. */
export const COLUMNAS: { key: keyof CobroInput; label: string }[] = [
  { key: "fecha", label: "Fecha" },
  { key: "concepto", label: "Concepto" },
  { key: "mesesCancelados", label: "Meses cancelados" },
  { key: "cantidadMeses", label: "Cant. meses" },
  { key: "total", label: "Total" },
  { key: "formaPago", label: "Forma de pago" },
  { key: "cobrador", label: "Cobrador" },
  { key: "codigo", label: "Código" },
];

export async function buscarClientes(q: string) {
  const { data } = await api.get<ClienteResultado[]>("/historial/buscar", { params: { q } });
  return data;
}

export async function obtenerFicha(nombre: string) {
  const { data } = await api.get<Ficha>("/historial/cliente", { params: { nombre } });
  return data;
}

export async function crearCobro(input: CobroInput) {
  const { data } = await api.post<CobroHistorico>("/historial", input);
  return data;
}

export async function actualizarCobro(id: string, input: Partial<CobroInput>) {
  const { data } = await api.patch<CobroHistorico>(`/historial/${id}`, input);
  return data;
}

export async function eliminarCobro(id: string) {
  await api.delete(`/historial/${id}`);
}

export async function previsualizarImport(registros: Record<string, unknown>[]) {
  const { data } = await api.post<ImportPreview>("/historial/import", { registros, preview: true });
  return data;
}

export async function confirmarImport(registros: Record<string, unknown>[], omitir: number[]) {
  const { data } = await api.post<{ insertados: number; omitidos: number }>("/historial/import", {
    registros,
    omitir,
  });
  return data;
}

export type RegistroListado = CobroHistorico & { fechaReconocida: boolean };

export type TodosQuery = {
  orden?: "asc" | "desc";
  desde?: string;
  hasta?: string;
  /** Nombre exacto, elegido de las sugerencias. */
  cliente?: string;
  page?: number;
  pageSize?: number;
};

/** Sólo ADMIN: todos los registros, ordenados por la fecha del documento. */
export async function listarTodos(query: TodosQuery) {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ""));
  const { data } = await api.get<{ items: RegistroListado[]; total: number; page: number; pageSize: number }>(
    "/historial/todos",
    { params }
  );
  return data;
}

/** Sólo ADMIN: hasta 10 nombres que coinciden con lo escrito (sin registros). */
export async function sugerirClientes(q: string) {
  const { data } = await api.get<ClienteResultado[]>("/historial/sugerencias", { params: { q } });
  return data;
}

/** Frase que el backend exige para vaciar el historial (BorrarTodoDto). */
export const FRASE_BORRAR_TODO = "BORRAR TODO";

/** Sólo ADMIN: borra TODOS los registros del historial. */
export async function borrarTodoElHistorial() {
  const { data } = await api.delete<{ borrados: number }>("/historial", {
    data: { confirmacion: FRASE_BORRAR_TODO },
  });
  return data;
}
