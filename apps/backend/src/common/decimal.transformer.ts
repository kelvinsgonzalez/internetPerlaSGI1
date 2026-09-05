import { ValueTransformer } from 'typeorm';

/**
 * Postgres devuelve las columnas `decimal` como string, lo que obligaba a
 * hacer parseFloat disperso por servicios y páginas. Este transformer las
 * normaliza a `number` al leerlas y deja el valor tal cual al escribirlas.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | string | null) => value,
  from: (value?: string | null) => {
    if (value === null || value === undefined) return value as null | undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  },
};
