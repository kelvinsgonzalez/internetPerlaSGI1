import { useEffect, useRef } from 'react';
import { sendLocation } from '../services/locationService';

interface UseLocationReporterOptions {
  intervalMinutes?: number; // Intervalo en minutos (default: 30)
  enabled?: boolean; // Activar/desactivar el reporte
}

/**
 * Hook que reporta la ubicación del trabajador periódicamente
 * Se activa automáticamente al montar el componente si `enabled` es true
 *
 * NOTA: En localhost sin HTTPS, Geolocation API puede fallar.
 * En producción con HTTPS funcionará correctamente.
 *
 * @param userId ID del usuario autenticado
 * @param options Opciones de configuración
 *
 * @example
 * function Dashboard() {
 *   const { user } = useAuth();
 *   useLocationReporter(user?.sub, { intervalMinutes: 60, enabled: user?.role === 'USER' });
 *   return <div>Dashboard...</div>;
 * }
 */
export function useLocationReporter(userId?: string, options: UseLocationReporterOptions = {}) {
  const { intervalMinutes = 30, enabled = true } = options;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasReportedOnce = useRef(false);

  useEffect(() => {
    // No activar si falta userId, está deshabilitado, o el navegador no tiene geolocation
    if (!userId || !enabled || !navigator.geolocation) {
      return;
    }

    console.log(
      `[useLocationReporter] Iniciando reportes de ubicación cada ${intervalMinutes} minutos para usuario ${userId}`
    );

    // Mostrar advertencia si estamos en localhost (sin HTTPS)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.warn('[useLocationReporter] ⚠️ Ejecutando en localhost. Geolocation funciona mejor con HTTPS.');
    }

    // Reportar ubicación inmediatamente al inicializar
    if (!hasReportedOnce.current) {
      sendLocation(userId).then((success) => {
        if (success) {
          hasReportedOnce.current = true;
          console.log('[useLocationReporter] ✅ Primer reporte completado');
        } else {
          console.warn('[useLocationReporter] ⚠️ Primer reporte sin ubicación (reintentará después)');
        }
      });
    }

    // Configurar intervalo periódico
    const intervalMs = intervalMinutes * 60 * 1000; // Convertir minutos a ms
    intervalRef.current = setInterval(() => {
      console.log(`[useLocationReporter] 🔄 Reporte periódico...`);
      sendLocation(userId).catch((err) => {
        console.debug('[useLocationReporter] Reintentará en siguiente ciclo');
      });
    }, intervalMs);

    // Cleanup: limpiar intervalo al desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('[useLocationReporter] 🛑 Reportes detenidos');
        intervalRef.current = null;
      }
    };
  }, [userId, enabled, intervalMinutes]);

  // Función manual para reportar inmediatamente (útil para debug)
  const reportNow = async () => {
    if (!userId) {
      console.warn('[useLocationReporter] No hay userId disponible');
      return false;
    }
    console.log('[useLocationReporter] 📍 Reporte manual solicitado');
    return sendLocation(userId);
  };

  return { reportNow };
}
