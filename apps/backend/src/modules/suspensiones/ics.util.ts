import { DateTime } from "luxon";
import { SuspensionAgenda } from "./suspension.model";

/**
 * Genera un archivo iCalendar (.ics) con las entradas de la agenda, para
 * importarlas en Google Calendar, Outlook o el calendario del celular.
 * Se arma a mano (formato de texto simple) para no sumar dependencias.
 */

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Las líneas de iCalendar no deben pasar de 75 octetos; se continúan con un espacio. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

const utcStamp = (dt: DateTime) => dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");

export const TIPO_AGENDA_LABEL: Record<string, string> = {
  COBRO_ACUERDO: "Cobro de acuerdo",
  VISITA: "Visita",
  RECOGER_EQUIPO: "Recoger equipo",
  SEGUIMIENTO: "Seguimiento",
  OTRO: "Otro",
};

export function agendaToIcs(entries: SuspensionAgenda[], tz: string): string {
  const now = utcStamp(DateTime.now());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//InternetPerla//Agenda de Suspensiones//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Agenda de suspensiones",
  ];

  for (const e of entries) {
    const desc = [
      `Tipo: ${TIPO_AGENDA_LABEL[e.tipo] ?? e.tipo}`,
      e.clienteNombre ? `Cliente: ${e.clienteNombre}` : null,
      e.responsableNombre ? `Responsable: ${e.responsableNombre}` : "Responsable: admin y supervisor",
      e.nota ? `Nota: ${e.nota}` : null,
      `Estado: ${e.estado}`,
    ]
      .filter(Boolean)
      .join("\n");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@internetperla-suspensiones`);
    lines.push(`DTSTAMP:${now}`);
    if (e.hora) {
      const start = DateTime.fromISO(`${e.fecha}T${e.hora}`, { zone: tz });
      lines.push(`DTSTART:${utcStamp(start)}`);
      lines.push(`DTEND:${utcStamp(start.plus({ hours: 1 }))}`);
    } else {
      const day = DateTime.fromISO(e.fecha);
      lines.push(`DTSTART;VALUE=DATE:${day.toFormat("yyyyLLdd")}`);
      lines.push(`DTEND;VALUE=DATE:${day.plus({ days: 1 }).toFormat("yyyyLLdd")}`);
    }
    lines.push(`SUMMARY:${escapeText(e.titulo)}`);
    lines.push(`DESCRIPTION:${escapeText(desc)}`);
    if (e.estado === "CANCELADO") lines.push("STATUS:CANCELLED");
    if (e.estado === "PENDIENTE") {
      // Con hora: aviso 1 h antes. Todo el día: aviso a las 08:00 de ese día.
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escapeText(e.titulo)}`);
      lines.push(e.hora ? "TRIGGER:-PT1H" : "TRIGGER;RELATED=START:PT8H");
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
