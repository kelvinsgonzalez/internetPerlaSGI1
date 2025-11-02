import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export function GeolocationHelper() {
  const [showWarning, setShowWarning] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';

    if (isLocalhost && !isHttps && navigator.geolocation) {
      setIsDev(true);
      setShowWarning(true);
    }
  }, []);

  if (!showWarning || !isDev) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-xs z-50">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 text-sm">
              🧪 Modo Desarrollo Activo
            </h3>
            <p className="text-blue-800 text-xs mt-1">
              ✅ Ubicaciones de prueba habilitadas automáticamente
            </p>
            <ul className="text-blue-800 text-xs mt-2 list-disc list-inside space-y-1">
              <li>Se están usando ubicaciones simuladas</li>
              <li>Perfecto para probar la funcionalidad</li>
              <li>Los reportes se enviarán al backend normalmente</li>
            </ul>
            <p className="text-blue-700 text-xs mt-2 italic">
              💡 Si tienes permisos HTTPS/reales, se usarán automáticamente.
            </p>
          </div>
          <button
            onClick={() => setShowWarning(false)}
            className="text-blue-600 hover:text-blue-900 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
