import api from "./api";

/** Bitácora de auditoría: toda acción que cambia datos y cada inicio de sesión. */

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  module: string;
  method: string;
  path: string;
  entityId: string | null;
  statusCode: number | null;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  error: string | null;
}

export interface AuditQuery {
  desde?: string;
  hasta?: string;
  userId?: string;
  module?: string;
  action?: string;
  success?: "true" | "false" | "";
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditOptions {
  modules: string[];
  users: { id: string; email: string; name: string | null }[];
}

export const AUDIT_ACTIONS: Record<string, string> = {
  CREAR: "Crear",
  ACTUALIZAR: "Actualizar",
  ELIMINAR: "Eliminar",
  LOGIN: "Inicio de sesión",
  LOGIN_FALLIDO: "Inicio fallido",
};

export const AUDIT_MODULES: Record<string, string> = {
  auth: "Acceso",
  users: "Usuarios",
  customers: "Clientes",
  plans: "Planes",
  attendance: "Asistencia",
  finance: "Finanzas",
  inventory: "Inventario",
  tasks: "Tareas",
  "task-archive": "Archivo de tareas",
  messages: "Mensajes",
  historial: "Historial de cobros",
  releases: "Novedades",
};

/** Quita las claves vacías para no mandar `?module=` al backend. */
const clean = (params: AuditQuery) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  );

export async function listAudit(params: AuditQuery) {
  const { data } = await api.get<AuditPage>("/audit", { params: clean(params) });
  return data;
}

export async function getAuditOptions() {
  const { data } = await api.get<AuditOptions>("/audit/opciones");
  return data;
}

export async function downloadAuditCsv(params: AuditQuery) {
  const { page: _p, pageSize: _s, ...rest } = params;
  const { data } = await api.get<Blob>("/audit/export", {
    params: clean(rest),
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bitacora-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
