/**
 * Inicializador que muestra ayuda en la consola del navegador
 */

export function initConsoleHelpers() {
  // Mensaje de bienvenida en consola
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isDev) {
    console.log(
      '%c🧪 MODO DESARROLLO - Sistema de Ubicación%c',
      'background: #4F46E5; color: white; padding: 10px; border-radius: 5px; font-weight: bold; font-size: 14px;',
      ''
    );

    console.log('%cℹ️ Información:', 'color: #4F46E5; font-weight: bold;');
    console.log('  • Ubicaciones de prueba están ACTIVAS');
    console.log('  • Los reportes se envían normalmente al backend');
    console.log('  • Revisa los logs [LocationService] y [useLocationReporter]');

    console.log('%c📍 Ubicaciones de Prueba Disponibles:', 'color: #4F46E5; font-weight: bold;');
    console.log('  • Centro San Pedro Sula (15.5, -88.0)');
    console.log('  • Zona Comercial (15.51, -88.01)');
    console.log('  • Industrial (15.49, -87.99)');
    console.log('  • Norte (15.52, -88.02)');
    console.log('  (Se rotan automáticamente en cada reporte)');

    console.log('%c🔧 Comandos Útiles:', 'color: #4F46E5; font-weight: bold;');
    console.log('  Para usar ubicación personalizada en consola:');
    console.log('  > setCustomDevLocation(15.5, -88.0)');
  }
}
