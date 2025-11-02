/**
 * Servicio de ubicación para desarrollo en localhost
 * Proporciona ubicaciones de prueba cuando Geolocation API falla
 */

// Ubicaciones por defecto en San Pedro Sula, Honduras
const DEFAULT_LOCATIONS = [
  { lat: 15.5, lng: -88.0, name: 'Centro San Pedro Sula' },
  { lat: 15.51, lng: -88.01, name: 'Zona Comercial' },
  { lat: 15.49, lng: -87.99, name: 'Industrial' },
  { lat: 15.52, lng: -88.02, name: 'Norte' },
];

let currentLocationIndex = 0;
let devModeEnabled = false;

/**
 * Activa el modo de desarrollo (usa ubicaciones mock en localhost)
 */
export function enableDevMode() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    devModeEnabled = true;
    console.log('[DevLocation] 🧪 Modo desarrollo activado - Usando ubicaciones de prueba');
    console.log('[DevLocation] 📍 Ubicaciones disponibles:', DEFAULT_LOCATIONS.map(l => l.name).join(', '));
  }
}

/**
 * Obtiene una ubicación de prueba (cicla entre las disponibles)
 */
export function getDevLocation(): { lat: number; lng: number } {
  if (!devModeEnabled) {
    throw new Error('Modo desarrollo no activado');
  }

  const location = DEFAULT_LOCATIONS[currentLocationIndex];
  currentLocationIndex = (currentLocationIndex + 1) % DEFAULT_LOCATIONS.length;

  console.log(`[DevLocation] 📍 Ubicación de prueba: ${location.name}`);
  return { lat: location.lat, lng: location.lng };
}

/**
 * Verifica si estamos en modo desarrollo
 */
export function isDevModeEnabled(): boolean {
  return devModeEnabled;
}

/**
 * Establece una ubicación personalizada
 */
export function setCustomDevLocation(lat: number, lng: number) {
  if (!devModeEnabled) {
    enableDevMode();
  }

  const customLocation = { lat, lng, name: 'Personalizada' };
  DEFAULT_LOCATIONS[0] = customLocation;
  currentLocationIndex = 0;

  console.log(`[DevLocation] 📍 Ubicación personalizada: ${lat}, ${lng}`);
}
