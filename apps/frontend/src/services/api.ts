import axios from "axios";

// =============================================================
// CONFIGURACIÓN BASE DEL API
// =============================================================
// Prioridad de resolución:
// 1) VITE_API_URL (absoluto, ej. https://api.midominio.com/api/v1)
// 2) VITE_API_BASE_URL (relativo, ej. /api/v1 para proxy de Vite)
// 3) Fallback automático al puerto 3000 (útil en desarrollo)
const apiUrl = (import.meta.env.VITE_API_URL as string) || undefined;
const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || undefined;

const isViteDev =
  typeof window !== "undefined" &&
  window.location &&
  (window.location.port === "5173" || window.location.port === "3001");

const devProxyBase = "/api/v1";
const fallbackBase = `${window.location.protocol}//${window.location.hostname}:3000/api/v1`;

const baseURL = apiUrl || apiBase || (isViteDev ? devProxyBase : fallbackBase);

// Instancia principal de Axios
const api = axios.create({ baseURL });

// =============================================================
// MANEJO DEL TOKEN DE AUTENTICACIÓN
// =============================================================

/**
 * Permite establecer o limpiar manualmente el header Authorization.
 * Se usa, por ejemplo, tras el login o logout.
 */
export function setAuth(token?: string) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

/**
 * Interceptor global: agrega automáticamente el Bearer token
 * desde el almacenamiento local antes de cada request.
 * Soporta tanto "accessToken" como "ip_token" por compatibilidad.
 */
api.interceptors.request.use((config) => {
  try {
    const token =
      localStorage.getItem("ip_token") || localStorage.getItem("accessToken");

    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignorar errores silenciosamente (por ejemplo, en modo SSR)
  }
  return config;
});

/**
 * Interceptor global de respuestas: ante un 401 limpia el token y redirige a login.
 * Evita dejar la UI vacía cuando el token caduca o el secreto cambia.
 */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && typeof window !== "undefined") {
      try {
        localStorage.removeItem("ip_token");
        const isOnLogin = window.location.pathname === "/login";
        if (!isOnLogin) window.location.href = "/login";
      } catch {
        // ignorar
      }
    }
    return Promise.reject(err);
  }
);

// =============================================================
// UTILIDAD
// =============================================================

/**
 * Devuelve el origen base del API (útil para sockets o assets).
 */
export function getApiOrigin() {
  try {
    return new URL(baseURL).origin;
  } catch {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
}

export default api;
