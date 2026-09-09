import api from "./api";

/**
 * Archivo de Tareas.
 *
 * El backend guarda cada tarea archivada como una linea de texto plano en un
 * fichero fuera de la base de datos, asi que estos registros siguen existiendo
 * aunque el cliente, el trabajador o la propia tarea desaparezcan de la BD.
 */

export interface ArchivedRef {
  id: string | null;
  nombre: string | null;
  email?: string | null;
}

export interface ArchivedCustomer {
  id: string | null;
  nombre: string | null;
  direccion: string | null;
  telefono: string | null;
  ipAsignada: string | null;
}

export interface ArchivedTask {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  telefonoContacto: string | null;
  cliente: ArchivedCustomer | null;
  trabajador: ArchivedRef | null;
  creadaPor: ArchivedRef | null;
  creadaEn: string | null;
  completadaEn: string | null;
  comentarioFinal: string | null;
  motivoObjecion: string | null;
  evidenciaUrl: string | null;
  archivadaEn: string;
  archivadaPor: ArchivedRef | null;
}

export interface ArchiveQuery {
  desde?: string;
  hasta?: string;
  clienteId?: string;
  trabajadorId?: string;
}

export interface ArchiveOptions {
  clientes: ArchivedRef[];
  trabajadores: ArchivedRef[];
}

/** Quita las claves vacias para no mandar `?clienteId=` al backend. */
const clean = (params?: ArchiveQuery) => {
  const out: Record<string, string> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (value) out[key] = value;
  }
  return out;
};

export const listArchivedTasks = (params?: ArchiveQuery) =>
  api
    .get<ArchivedTask[]>("/task-archive", { params: clean(params) })
    .then((r) => r.data);

export const getArchiveOptions = () =>
  api.get<ArchiveOptions>("/task-archive/opciones").then((r) => r.data);

export const archiveTask = (id: string) =>
  api.post<{ id: string; archived: boolean }>(`/tasks/${id}/archive`).then(
    (r) => r.data
  );

/** Descarga el archivo filtrado como .txt legible. */
export const downloadArchiveTxt = async (params?: ArchiveQuery) => {
  const res = await api.get("/task-archive/export", {
    params: clean(params),
    responseType: "blob",
  });
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "archivo-de-tareas.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
