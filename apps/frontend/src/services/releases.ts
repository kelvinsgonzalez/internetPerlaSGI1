import api from "./api";
import type { Role } from "./roles";

/** Novedades: notas de cada versión publicada por el ADMIN. */

export interface AppRelease {
  id: string;
  version: string;
  title: string;
  notes: string;
  audience: Role[];
  publishedAt: string;
  createdBy: string | null;
  createdAt: string;
  unread?: boolean;
}

export interface MyReleases {
  items: AppRelease[];
  unreadCount: number;
  latestVersion: string | null;
  seenAt: string | null;
}

export type ReleaseInput = {
  version: string;
  title: string;
  notes: string;
  audience: Role[];
  publishedAt?: string;
};

export async function getMyReleases() {
  const { data } = await api.get<MyReleases>("/releases");
  return data;
}

export async function markReleasesSeen() {
  await api.post("/releases/seen");
}

export async function listAllReleases() {
  const { data } = await api.get<AppRelease[]>("/releases/all");
  return data;
}

export async function createRelease(input: ReleaseInput) {
  const { data } = await api.post<AppRelease>("/releases", input);
  return data;
}

export async function updateRelease(id: string, input: Partial<ReleaseInput>) {
  const { data } = await api.patch<AppRelease>(`/releases/${id}`, input);
  return data;
}

export async function deleteRelease(id: string) {
  await api.delete(`/releases/${id}`);
}

/** Cada línea de las notas es un cambio; se quitan viñetas escritas a mano. */
export const releaseLines = (notes: string) =>
  notes
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
