import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Bucket {
  failures: number;
  windowStart: number;
  blockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000; // ventana de conteo: 15 minutos
const BLOCK_MS = 15 * 60 * 1000; // castigo tras agotar los intentos
const MAX_ENTRIES = 10_000; // techo de memoria del mapa

/**
 * Freno de fuerza bruta en memoria.
 *
 * Sin esto, `POST /auth/login` acepta miles de intentos por minuto: con la
 * contraseña del admin publicada en el repositorio durante meses, un diccionario
 * pequeño bastaba. Se cuenta por clave (IP + correo, y también sólo IP) y se
 * bloquea temporalmente al superar el límite.
 *
 * El estado es del proceso: suficiente para el despliegue de un solo contenedor
 * de este proyecto. Si algún día se escala a varias réplicas, esto debe pasar a
 * Redis o a una tabla.
 */
@Injectable()
export class BruteForceService {
  private readonly buckets = new Map<string, Bucket>();

  /** Lanza 429 si la clave está castigada. Llamar ANTES de verificar. */
  assertAllowed(key: string, max: number) {
    this.sweep();
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    const now = Date.now();
    if (bucket.blockedUntil > now) {
      const seconds = Math.ceil((bucket.blockedUntil - now) / 1000);
      throw new HttpException(
        `Demasiados intentos fallidos. Vuelve a intentarlo en ${Math.ceil(seconds / 60)} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (now - bucket.windowStart > WINDOW_MS) this.buckets.delete(key);
    else if (bucket.failures >= max) {
      bucket.blockedUntil = now + BLOCK_MS;
      throw new HttpException(
        'Demasiados intentos fallidos. Vuelve a intentarlo en 15 minuto(s).',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Suma un intento fallido. */
  registerFailure(key: string, max: number) {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart > WINDOW_MS) {
      this.buckets.set(key, { failures: 1, windowStart: now, blockedUntil: 0 });
      return;
    }
    bucket.failures += 1;
    if (bucket.failures >= max) bucket.blockedUntil = now + BLOCK_MS;
  }

  /** Un acierto limpia el historial de esa clave. */
  reset(key: string) {
    this.buckets.delete(key);
  }

  /** Descarta entradas caducadas para que el mapa no crezca sin límite. */
  private sweep() {
    if (this.buckets.size < MAX_ENTRIES) return;
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.blockedUntil <= now && now - bucket.windowStart > WINDOW_MS) {
        this.buckets.delete(key);
      }
    }
  }
}
