import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth'; // O la ruta a tu hook de auth

export const useLocationTracking = () => {
  const { token, user } = useAuth(); // Asumiendo que useAuth provee el token y el usuario
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!token || user?.role === 'ADMIN') {
      // Si no hay token o el usuario es admin, no hacer nada
      return;
    }

    const sendLocation = (position: GeolocationPosition) => {
      console.log('Sending location to backend...');
      const { latitude, longitude } = position.coords;
      
      fetch(`${import.meta.env.VITE_API_URL}/users/update-location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude: latitude,
          longitude: longitude
        })
      })
      .then(res => console.log('Location sent successfully:', res))
      .catch(err => console.error('Error sending location:', err));
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('Error getting location:', error.message);
    };

    if ('geolocation' in navigator) {
      // Inicia el rastreo
      watchId.current = navigator.geolocation.watchPosition(
        sendLocation, 
        handleError, 
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0 
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
    }

    // Limpieza: deja de rastrear cuando el componente se desmonte
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };

  }, [token]); // El efecto se re-ejecuta si el token cambia
};