import api from './api';
import { isDevModeEnabled, getDevLocation } from './devLocation';

interface LocationPayload {
  lat: number;
  lng: number;
  timestamp: string;
}

/**
 * Obtiene la ubicación actual del navegador usando Geolocation API
 * @returns Promise con lat, lng o null si no hay permiso
 */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[LocationService] Geolocation API no disponible');
      resolve(null);
      return;
    }

    // Estrategia: Intentar con opciones relajadas primero
    const options = {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 600000,
    };

    let timeoutId: ReturnType<typeof setTimeout>;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        try {
          const { latitude, longitude, accuracy } = position.coords;
          const accuracyStr = accuracy ? ` (±${accuracy.toFixed(0)}m)` : '';
          console.log(`[LocationService] ✅ Ubicación: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${accuracyStr}`);
          resolve({ lat: latitude, lng: longitude });
        } catch (err) {
          console.error('[LocationService] Error procesando coordenadas:', err);
          resolve(null);
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        const code = error.code;

        // Si hay error de permiso en localhost y dev mode está activo, usar fallback
        if (code === 1 && isDevModeEnabled()) { // PERMISSION_DENIED
          try {
            const devLocation = getDevLocation();
            console.log(`[LocationService] 🧪 Usando ubicación de desarrollo: ${devLocation.lat.toFixed(4)}, ${devLocation.lng.toFixed(4)}`);
            resolve(devLocation);
            return;
          } catch (e) {
            console.log('[LocationService] Dev mode no disponible');
          }
        }

        switch (code) {
          case 1: // PERMISSION_DENIED
            console.error('[LocationService] ❌ Permiso denegado - Verifica ajustes de navegador');
            break;
          case 2: // POSITION_UNAVAILABLE
            console.warn('[LocationService] ⚠️ Posición no disponible - Usando datos cacheados');
            break;
          case 3: // TIMEOUT
            console.warn('[LocationService] ⏱️ Timeout - Intenta de nuevo');
            break;
          default:
            console.warn(`[LocationService] ⚠️ Error: ${error.message}`);
        }

        resolve(null);
      },
      options,
    );

    // Extra: Timeout adicional por si acaso
    timeoutId = setTimeout(() => {
      console.warn('[LocationService] ⏱️ Timeout interno - operación cancelada');
      resolve(null);
    }, 12000);
  });
}

/**
 * Envía la ubicación actual al backend
 * @param userId ID del usuario
 * @returns true si se envió exitosamente, false en caso de error
 */
export async function sendLocation(userId: string): Promise<boolean> {
  try {
    const location = await getCurrentLocation();

    if (!location) {
      return false;
    }

    const payload: LocationPayload = {
      lat: location.lat,
      lng: location.lng,
      timestamp: new Date().toISOString(),
    };

    console.log(`[LocationService] 📤 Enviando: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);

    const response = await api.post('/locations', payload);
    console.log(`[LocationService] ✅ Exitoso`);
    return true;
  } catch (error: any) {
    return false;
  }
}

/**
 * Obtiene la última ubicación de todos los trabajadores
 * @returns Array de ubicaciones recientes
 */
export async function getLatestLocations() {
  try {
    const { data } = await api.get('/locations/latest');
    return data;
  } catch (error: any) {
    console.error('[LocationService] Error al obtener ubicaciones:', error.message);
    return [];
  }
}

/**
 * Obtiene el historial de ubicaciones de un usuario en una fecha específica
 * @param userId ID del usuario
 * @param date Fecha en formato YYYY-MM-DD
 * @returns Array de ubicaciones históricas
 */
export async function getUserLocationHistory(userId: string, date?: string) {
  try {
    const query = date ? `?date=${date}` : '';
    const { data } = await api.get(`/locations/${userId}${query}`);
    return data;
  } catch (error: any) {
    console.error('[LocationService] Error al obtener historial:', error.message);
    return [];
  }
}
