// Sólo orígenes de desarrollo local. En producción `CORS_ORIGINS` es
// obligatorio: si falta, es preferible que el navegador falle a que el API
// quede abierto a un dominio heredado que ya no controlamos.
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3001',
];

/**
 * Orígenes permitidos para HTTP y WebSocket.
 * Se lee de `CORS_ORIGINS` (lista separada por comas) en cada llamada, no al
 * importar el módulo, porque el gateway se declara antes de que ConfigModule
 * cargue el archivo .env.
 */
export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ORIGINS;
}

export function isOriginAllowed(origin?: string): boolean {
  // Sin cabecera Origin (curl, health checks, apps nativas) no hay nada que bloquear.
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
}
