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
 * Sin esto, un token inválido o caducado (por ejemplo, uno emitido por otro
 * backend o con otro JWT_SECRET) deja la app en un estado "sesión iniciada"
 * en el que TODAS las peticiones fallan con 401 en silencio: las pantallas se
 * ven vacías y no se puede guardar nada. Al primer 401 se cierra la sesión.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || "";
    // Un 401 en el propio login es "credenciales incorrectas", no sesión caducada.
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/register");

    if (status === 401 && !isAuthCall) {
      try {
        localStorage.removeItem("ip_token");
        localStorage.removeItem("accessToken");
      } catch {
        /* almacenamiento no disponible */
      }
      setAuth(undefined);
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  }
);

// =============================================================
// UTILIDAD
// =============================================================

/**
 * Devuelve el origen base del API (útil para assets servidos en /uploads).
 */
export function getApiOrigin() {
  try {
    return new URL(baseURL, window.location.origin).origin;
  } catch {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
}

/**
 * Origen para Socket.IO. Prioriza `VITE_SOCKET_URL` — que hasta ahora se
 * documentaba y se inyectaba en el build pero no se leía en ningún sitio — y
 * cae al origen del API cuando no está definida.
 */
export function getSocketOrigin() {
  const socketUrl = (import.meta.env.VITE_SOCKET_URL as string) || undefined;
  if (socketUrl) {
    try {
      return new URL(socketUrl, window.location.origin).origin;
    } catch {
      /* configuración inválida: usar el origen del API */
    }
  }
  return getApiOrigin();
}

export default api;
