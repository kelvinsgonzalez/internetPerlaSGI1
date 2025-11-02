import api from "./api";

export interface InternetPlan {
  id: string;
  name: string;
  price: string;
  speed?: string;
}

export interface CustomerDto {
  id: string;
  nombreCompleto: string;
  telefono?: string;
  direccion?: string;
  ipAsignada?: string;
  latitud?: string; // decimals represented as string from API
  longitud?: string;
  estadoCliente: string;
  notas?: string;
  planDeInternet?: string;
  plan?: InternetPlan | null;
}

export interface CreateCustomerInput {
  nombreCompleto: string;
  telefono?: string;
  direccion?: string;
  ipAsignada?: string;
  latitud?: string;
  longitud?: string;
  estadoCliente?: string;
  notas?: string;
  planId?: string;
  planDeInternet?: string; // alternative to planId
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {}

export interface CustomerConflict {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  ipAsignada?: string;
  latitud?: string;
  longitud?: string;
  planName?: string;
  reason?: string;
  rowData?: any;
  createdAt: string;
}

export async function listCustomers(): Promise<CustomerDto[]> {
  const { data } = await api.get("/customers");
  return data;
}

export async function createCustomer(
  input: CreateCustomerInput
): Promise<CustomerDto> {
  const { data } = await api.post("/customers", input);
  return data;
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<CustomerDto> {
  const { data } = await api.patch(`/customers/${id}`, input);
  return data;
}

export async function removeCustomer(id: string): Promise<void> {
  await api.delete(`/customers/${id}`);
}

export async function importCustomersCsv(
  file: File
): Promise<{ inserted: number; conflicts: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/customers/import", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listConflicts(): Promise<CustomerConflict[]> {
  const { data } = await api.get("/customers/conflicts");
  return data;
}

export async function listPlans(): Promise<InternetPlan[]> {
  const { data } = await api.get("/plans");
  return data;
}
