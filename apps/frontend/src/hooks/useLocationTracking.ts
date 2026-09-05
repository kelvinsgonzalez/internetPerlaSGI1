import { useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from './useAuth';

/**
 * Reporta la ubicación del colaborador mientras tiene sesión abierta.
 * Los ADMIN no se rastrean.
 */
export const useLocationTracking = () => {
  const { token, user } = useAuth();
  const watchId = useRef<number | null>(null);

  const isTrackable = Boolean(token) && user?.role === 'USER';

  useEffect(() => {
    if (!isTrackable) return;

    if (!('geolocation' in navigator)) {
      console.error('Geolocation is not supported by this browser.');
      return;
    }

    const sendLocation = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      // Usa el cliente axios: así respeta VITE_API_URL o VITE_API_BASE_URL y
      // adjunta el token igual que el resto de la app.
      api
        .patch('/users/update-location', { latitude, longitude })
        .catch((err) => console.error('Error sending location:', err));
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('Error getting location:', error.message);
    };

    watchId.current = navigator.geolocation.watchPosition(
      sendLocation,
      handleError,
      {
        // Alta precisión con maximumAge 0 mantenía el GPS encendido de forma
        // permanente; esto sigue siendo suficiente para ubicar a un técnico.
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000,
      },
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
    // `user.role` decide si se rastrea, así que tiene que estar en las deps:
    // antes sólo estaba `token` y el efecto se quedaba con el rol anterior.
  }, [isTrackable]);
};
