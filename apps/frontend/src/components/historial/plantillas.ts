/**
 * Plantillas descargables para la importación del historial.
 *
 * El Excel se genera aquí mismo (sin dependencias): un .xlsx mínimo con todas
 * las columnas en formato TEXTO, para que Excel no convierta fechas ni montos
 * ("1/10/2022 16:41:31" o "250.00") y se conserven tal cual al guardar el CSV.
 */

/** Encabezados que reconoce el backend (ver HEADER_MAP en historial.service.ts). */
export const ENCABEZADOS = [
  "Id",
  "Cliente",
  "Ubicación",
  "Concepto",
  "Fecha",
  "Meses_Cancelados",
  "Cantidad_Meses_pagados",
  "Total",
  "Forma de pago",
  "Cobrador",
  "Codigo",
] as const;

type Fila = Record<(typeof ENCABEZADOS)[number], string>;

const EJEMPLOS: Fila[] = [
  {
    Id: "1001",
    Cliente: "María López",
    "Ubicación": "Zona 5, Guatemala",
    Concepto: "Mensualidad",
    Fecha: "15/3/2021 9:05:00",
    Meses_Cancelados: "Marzo",
    Cantidad_Meses_pagados: "1",
    Total: "125.00",
    "Forma de pago": "Depósito",
    Cobrador: "Ana",
    Codigo: "C-777",
  },
  {
    Id: "1002",
    Cliente: "María López",
    "Ubicación": "Zona 5, Guatemala",
    Concepto: "Mensualidad",
    Fecha: "1/10/2022 16:41:31",
    Meses_Cancelados: "Abril Mayo",
    Cantidad_Meses_pagados: "2",
    Total: "250.00",
    "Forma de pago": "Efectivo",
    Cobrador: "Juan",
    Codigo: "C-777",
  },
  {
    Id: "1003",
    Cliente: "Mario Pérez",
    "Ubicación": "Villa Nueva",
    Concepto: "Instalación",
    Fecha: "5/6/2023 8:15:00",
    Meses_Cancelados: "",
    Cantidad_Meses_pagados: "",
    Total: "300",
    "Forma de pago": "Transferencia",
    Cobrador: "Ana",
    Codigo: "C-900",
  },
];

const descargar = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export function descargarEjemploJSON() {
  const contenido = JSON.stringify(EJEMPLOS, null, 2);
  descargar(new Blob([contenido], { type: "application/json;charset=utf-8" }), "ejemplo-historial.json");
}

export function descargarPlantillaExcel() {
  descargar(
    new Blob([crearXlsx([[...ENCABEZADOS], ...EJEMPLOS.map((f) => ENCABEZADOS.map((h) => f[h]))])], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "plantilla-historial.xlsx"
  );
}

// ── Generador .xlsx mínimo ───────────────────────────────────────────────────

const xml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const columna = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function crearXlsx(filas: string[][]): Uint8Array<ArrayBuffer> {
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const nCols = filas[0].length;

  // Estilos: 0 normal · 1 texto (@) · 2 encabezado texto en negrita con fondo.
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet ${ns}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const filasXml = filas
    .map(
      (fila, r) =>
        `<row r="${r + 1}">${fila
          .map((v, c) => `<c r="${columna(c)}${r + 1}" s="${r === 0 ? 2 : 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`)
          .join("")}</row>`
    )
    .join("");

  // Columnas con estilo texto: lo que se escriba en filas nuevas también queda como texto.
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${ns}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${nCols}" width="22" style="1" customWidth="1"/></cols><sheetData>${filasXml}</sheetData></worksheet>`;

  const archivos: [string, string][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Historial" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ["xl/styles.xml", styles],
    ["xl/worksheets/sheet1.xml", sheet],
  ];

  return zip(archivos.map(([nombre, contenido]) => [nombre, new TextEncoder().encode(contenido)]));
}

// ── ZIP sin compresión (método "store"), suficiente para un .xlsx ─────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zip(archivos: [string, Uint8Array][]): Uint8Array<ArrayBuffer> {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [nombre, data] of archivos) {
    const nombreBytes = new TextEncoder().encode(nombre);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versión necesaria
    local.setUint16(8, 0, true); // método: store
    local.setUint16(12, 0x21, true); // fecha DOS: 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nombreBytes.length, true);
    partes.push(new Uint8Array(local.buffer), nombreBytes, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(14, 0x21, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nombreBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nombreBytes);

    offset += 30 + nombreBytes.length + data.length;
  }

  const tamCentral = central.reduce((n, p) => n + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, offset, true);

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(todo.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of todo) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
