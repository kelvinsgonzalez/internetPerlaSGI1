import * as bcrypt from 'bcryptjs';

/**
 * Política de contraseñas y correos retirados.
 *
 * Todo lo relacionado con credenciales vive aquí para que exista una única
 * definición: si la política cambia, cambia en un sitio y aplica a registro,
 * alta de colaboradores y cambio de contraseña por igual.
 */

/** Coste de bcrypt. 12 ≈ 250 ms por hash: encarece el crackeo offline. */
export const BCRYPT_ROUNDS = 12;

/** Mínimo 8 caracteres con minúscula, mayúscula, dígito y símbolo. */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_RULE_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y símbolo';

/**
 * Correos dados de baja de forma permanente, leídos del entorno para no dejar
 * ninguna cuenta identificable en el repositorio: quien clone el código no debe
 * poder deducir contra qué usuarios intentar un ataque.
 *
 * - `LEGACY_ADMIN_EMAIL`: el admin anterior, migrado y retirado.
 * - `RETIRED_EMAILS`: lista opcional separada por comas para futuras bajas.
 *
 * Se resuelve en cada llamada (y no una vez al importar) para que los tests y
 * los scripts puedan ajustar el entorno antes de usarlo.
 */
function retiredEmails(): Set<string> {
  const raw = [process.env.LEGACY_ADMIN_EMAIL, ...(process.env.RETIRED_EMAILS ?? '').split(',')];
  return new Set(
    raw
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => !!value),
  );
}

export function isRetiredEmail(email?: string | null): boolean {
  if (!email) return false;
  return retiredEmails().has(email.trim().toLowerCase());
}

/**
 * Hash real de descarte contra el que comparar cuando el correo no existe.
 * Si se devolviera "credenciales inválidas" al instante, el tiempo de respuesta
 * revelaría qué correos están registrados (enumeración de usuarios).
 * Se calcula una vez al arrancar para que el coste sea idéntico al de un login
 * legítimo.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'contrasena-inexistente-solo-para-igualar-tiempos',
  BCRYPT_ROUNDS,
);
