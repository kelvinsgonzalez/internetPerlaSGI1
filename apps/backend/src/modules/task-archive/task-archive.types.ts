/**
 * Tipos del Archivo de Tareas.
 *
 * El archivo es un fichero de TEXTO PLANO (una linea JSON por tarea) que vive
 * fuera de la base de datos: sobrevive a borrados, migraciones y recreaciones
 * del contenedor de Postgres. Por eso cada registro guarda una copia completa
 * de los datos (nombre del cliente, del trabajador, etc.) y no solo sus IDs:
 * aunque el cliente o el usuario desaparezcan de la base, el archivo sigue
 * siendo legible por si solo.
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

export interface ArchiveFilters {
  /** Fecha de creacion (YYYY-MM-DD, zona horaria del negocio) desde la cual incluir. */
  desde?: string;
  /** Fecha de creacion (YYYY-MM-DD) hasta la cual incluir, inclusive. */
  hasta?: string;
  clienteId?: string;
  trabajadorId?: string;
}
