export type Role = 'ADMIN' | 'SUPERVISOR' | 'USER';

// ADMIN y SUPERVISOR usan el panel de gestión (Asistencia, Finanzas, Tareas,
// Mapa y Mensajes). Sólo ADMIN administra usuarios, clientes e inventario.
export const MANAGEMENT_ROLES: Role[] = ['ADMIN', 'SUPERVISOR'];

export const isManager = (role?: string | null) => role === 'ADMIN' || role === 'SUPERVISOR';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  USER: 'Colaborador',
};
