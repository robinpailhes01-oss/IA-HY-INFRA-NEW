// Parseur .ics minimal, pour importer l'historique clients 2023-2025 depuis
// un export Google Calendar de l'ancienne marque (Next Yacht).
//
// Volontairement écrit à la main plutôt que via une librairie : le besoin est
// étroit (VEVENT → un client), et l'ancien calendrier n'a pas la structure
// prévisible du calendrier actuel (pas de "Client: / Email: / Téléphone:" —
// le client est l'invité de l'événement, identifié par son email). Une vraie
// librairie RFC 5545 gérerait des cas (récurrence, fuseaux avancés) qu'on n'a
// pas besoin de couvrir ici.

export type ParsedIcsEvent = {
  uid: string;
  summary: string;
  description: string;
  date: string | null; // YYYY-MM-DD
  attendees: Array<{ name: string | null; email: string }>;
  organizerEmail: string | null;
};

/** Déplie les lignes .ics : une propriété continuée commence par un espace. */
function unfold(text: string): string[] {
  const raw = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Décode les échappements .ics (\, \n, \; \,) dans une valeur de propriété. */
function unescapeIcsValue(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Extrait le paramètre CN= (nom affiché) d'une ligne ATTENDEE/ORGANIZER. */
function extractCn(paramsPart: string): string | null {
  const m = paramsPart.match(/CN=([^;:]+)/i);
  return m ? unescapeIcsValue(m[1].replace(/^"|"$/g, "")) : null;
}

/** Extrait l'email d'une ligne ATTENDEE/ORGANIZER (après "mailto:" ou en fin de ligne). */
function extractMailto(value: string): string | null {
  const m = value.match(/mailto:([^\s;]+)/i);
  return m ? m[1].trim().toLowerCase() : null;
}

/** Convertit une date .ics (DTSTART;VALUE=DATE:20250714 ou avec heure) en YYYY-MM-DD. */
function toIsoDate(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 8);
  if (digits.length < 8) return null;
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  return `${y}-${m}-${d}`;
}

export function parseIcsEvents(icsText: string): ParsedIcsEvent[] {
  const lines = unfold(icsText);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let current: {
    uid: string;
    summary: string;
    description: string;
    date: string | null;
    attendees: Array<{ name: string | null; email: string }>;
    organizerEmail: string | null;
  } | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = { uid: "", summary: "", description: "", date: null, attendees: [], organizerEmail: null };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        // Sans UID exploitable, l'événement ne peut pas être dédoublonné de
        // façon fiable à un futur réimport — on préfère le sauter plutôt que
        // de risquer un doublon silencieux.
        if (current.uid) events.push(current as ParsedIcsEvent);
      }
      inEvent = false;
      current = null;
      continue;
    }
    if (!inEvent || !current) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const [prop, ...paramParts] = left.split(";");
    const params = paramParts.join(";");

    switch (prop) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.summary = unescapeIcsValue(value.trim());
        break;
      case "DESCRIPTION":
        current.description = unescapeIcsValue(value.trim());
        break;
      case "DTSTART":
        current.date = toIsoDate(value);
        break;
      case "ORGANIZER":
        current.organizerEmail = extractMailto(value);
        break;
      case "ATTENDEE": {
        const email = extractMailto(value);
        if (email) current.attendees.push({ name: extractCn(params), email });
        break;
      }
    }
  }

  return events;
}

/** Sépare "Prénom Nom" en (prénom, nom) — best-effort, sur simple espace. */
export function splitName(fullName: string | null): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Extrait un numéro de téléphone d'un texte libre (description), si présent. */
export function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+33|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/);
  return m ? m[0].replace(/[\s.-]/g, "") : null;
}
