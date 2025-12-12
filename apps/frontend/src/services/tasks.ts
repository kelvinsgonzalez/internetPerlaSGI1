import api from "./api";

export type TaskStatus = "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "OBJETADA";

export interface UserRef {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "USER";
}

export interface CustomerRef {
  id: string;
  nombreCompleto: string | null;
  direccion?: string | null;
  telefono?: string | null;
  ipAsignada?: string | null;
  latitud?: string | null;
  longitud?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  telefonoContacto: string;
  customer: CustomerRef | null;
  assignedTo: UserRef;
  createdBy: UserRef;
  createdAt: string;
  updatedAt: string;
  motivoObjecion?: string | null;
  comentarioFinal?: string | null;
  completedAt?: string | null;
  proofUrl?: string | null;
  archived: boolean;
  archivedAt?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  customerId: string;
  assignedToId: string;
  telefonoContacto: string;
}

export interface UpdateTaskInput {
  description?: string;
  assignedToId?: string;
  status?: TaskStatus;
  motivoObjecion?: string;
  comentarioFinal?: string;
  telefonoContacto?: string;
}

export const listTasks = (params?: {
  status?: TaskStatus;
  assignedToId?: string;
  customerId?: string;
  archived?: boolean;
}) => api.get<Task[]>("/tasks", { params }).then((r) => r.data);

export const listMyTasks = (params?: {
  status?: TaskStatus;
  customerId?: string;
}) => api.get<Task[]>("/tasks/mine", { params }).then((r) => r.data);

export const createTask = (input: CreateTaskInput) =>
  api.post<Task>("/tasks", input).then((r) => r.data);

export const updateTask = (id: string, input: UpdateTaskInput) =>
  api.patch<Task>(`/tasks/${id}`, input).then((r) => r.data);

export const archiveTask = (id: string) =>
  api.patch<Task>(`/tasks/${id}/archive`).then((r) => r.data);

export const deleteTask = (id: string) =>
  api.delete(`/tasks/${id}`).then((r) => r.data);
