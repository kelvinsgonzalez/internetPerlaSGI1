import api from "./api";

export type Customer = {
  id: string;
  nombreCompleto: string;
  direccion?: string;
  telefono?: string;
};

export async function getCustomers() {
  const res = await api.get("/customers");
  return res.data?.value ?? res.data;
}
