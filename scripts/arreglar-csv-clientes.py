#!/usr/bin/env python3
"""
Limpia un CSV de clientes exportado desde Excel antes de importarlo.

    python3 scripts/arreglar-csv-clientes.py ~/Downloads/clientes.csv

Escribe <archivo>-corregido.csv al lado del original y deja el original
intacto. Al final imprime un informe de lo que arregló y de lo que NO puede
arreglar solo.

Qué corrige automáticamente:
  - Espacios dentro de latitud/longitud ("15. 362331" -> "15.362331").
  - Coordenadas con coma decimal ("15,4062" -> "15.4062").
  - Espacios sobrantes al inicio/final de cada campo.
  - Filas completamente vacías.
  - Separador ";" o tabulador: el archivo corregido siempre se escribe con
    comas, que es el único separador que acepta el importador.

Qué sólo señala (no puede inventar el dato):
  - Teléfonos convertidos a notación científica por Excel ("5.29626E+11").
  - Coordenadas en 0, que dejan al cliente fuera del mapa.
  - Nombres repetidos, que el importador marcará como conflicto.
"""

import csv
import re
import sys
from pathlib import Path

COORD_CON_ESPACIO = re.compile(r"^\s*(-?\d+)\.\s*(\d+)\s*$")
COORD_ESPACIO_INTERNO = re.compile(r"^\s*(-?[\d.]+)\s+(\d+)\s*$")
NOTACION_CIENTIFICA = re.compile(r"^\s*\d+\.?\d*[eE][+-]?\d+\s*$")


def detectar_separador(linea: str) -> str:
    """Excel en español exporta con ';'. Se elige el que más aparece."""
    return max([",", ";", "\t"], key=lambda c: linea.count(c))


def limpiar_coordenada(valor: str) -> tuple[str, bool]:
    original = valor
    valor = valor.strip().replace(",", ".")
    # "15. 362331" -> "15.362331"
    m = COORD_CON_ESPACIO.match(valor)
    if m:
        valor = f"{m.group(1)}.{m.group(2)}"
    else:
        # "-91.983816 2" -> "-91.9838162"
        m = COORD_ESPACIO_INTERNO.match(valor)
        if m:
            valor = f"{m.group(1)}{m.group(2)}"
    return valor, valor != original


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    origen = Path(sys.argv[1]).expanduser()
    if not origen.is_file():
        print(f"No existe el archivo: {origen}", file=sys.stderr)
        return 1

    texto = origen.read_text(encoding="utf-8-sig")
    lineas = texto.splitlines()
    if not lineas:
        print("El archivo está vacío.", file=sys.stderr)
        return 1

    sep = detectar_separador(lineas[0])
    filas = list(csv.reader(lineas, delimiter=sep))
    cabecera = [h.strip().lower() for h in filas[0]]

    def indice(*nombres):
        for n in nombres:
            if n in cabecera:
                return cabecera.index(n)
        return -1

    i_nombre = indice("nombre", "name")
    i_lat = indice("latitud")
    i_lon = indice("longitud")
    i_tel = indice("telefono", "phone")

    if i_nombre == -1:
        print('El CSV debe tener una columna "nombre" o "name".', file=sys.stderr)
        return 1

    coords_arregladas = []
    telefonos_rotos = []
    coords_en_cero = []
    vistos = {}
    duplicados = []
    salida = [filas[0]]

    for n_linea, fila in enumerate(filas[1:], start=2):
        if not any(c.strip() for c in fila):
            continue
        fila = [c.strip() for c in fila]
        nombre = fila[i_nombre] if i_nombre < len(fila) else ""

        for idx, etiqueta in ((i_lat, "latitud"), (i_lon, "longitud")):
            if idx != -1 and idx < len(fila):
                nuevo, cambio = limpiar_coordenada(fila[idx])
                if cambio:
                    coords_arregladas.append(
                        f"  linea {n_linea}: {nombre[:38]} | {etiqueta}: "
                        f"{fila[idx]!r} -> {nuevo!r}"
                    )
                fila[idx] = nuevo

        if i_tel != -1 and i_tel < len(fila) and NOTACION_CIENTIFICA.match(fila[i_tel]):
            telefonos_rotos.append(f"  linea {n_linea}: {nombre[:38]} | {fila[i_tel]}")

        if i_lat != -1 and i_lon != -1 and i_lon < len(fila):
            if fila[i_lat] in ("0", "0.0", "") and fila[i_lon] in ("0", "0.0", ""):
                coords_en_cero.append(f"  linea {n_linea}: {nombre[:38]}")

        clave = nombre.strip().lower()
        if clave in vistos:
            duplicados.append(
                f"  lineas {vistos[clave]} y {n_linea}: {nombre[:38]}"
            )
        else:
            vistos[clave] = n_linea

        salida.append(fila)

    destino = origen.with_name(f"{origen.stem}-corregido{origen.suffix}")
    with destino.open("w", encoding="utf-8", newline="") as fh:
        # El importador solo acepta la coma como separador.
        csv.writer(fh, delimiter=",", quoting=csv.QUOTE_MINIMAL).writerows(salida)

    def bloque(titulo, items, nota=""):
        print(f"\n{titulo}: {len(items)}")
        if nota and items:
            print(f"  {nota}")
        for x in items[:20]:
            print(x)
        if len(items) > 20:
            print(f"  ... y {len(items) - 20} más")

    print(f"Archivo corregido: {destino}")
    print(
        f"Filas de datos: {len(salida) - 1}   "
        f"Separador detectado: {sep!r} -> escrito con ','"
    )
    bloque("Coordenadas corregidas", coords_arregladas)
    bloque(
        "Teléfonos que Excel rompió (NO recuperables)",
        telefonos_rotos,
        "Vuelve a exportar con la columna en formato Texto, o corrígelos a mano.",
    )
    bloque(
        "Clientes sin coordenadas",
        coords_en_cero,
        "Se importan, pero no aparecerán en el mapa.",
    )
    bloque(
        "Nombres repetidos",
        duplicados,
        "Si además comparten dirección, el importador los marcará como conflicto.",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
