/**
 * Generate an .ics calendar file content for an appointment.
 */
export function generateIcsFile(params: {
  title: string;
  startAt: string; // ISO string
  endAt: string;   // ISO string
  location?: string;
  description?: string;
  timezone: string;
}): Buffer {
  const { title, startAt, endAt, location, description, timezone } = params;

  // Format date to iCalendar format: 20260209T150000
  const formatDate = (isoString: string): string => {
    return isoString.replace(/[-:]/g, "").replace(/\.\d+/, "").replace("Z", "");
  };

  const dtStart = formatDate(startAt);
  const dtEnd = formatDate(endAt);
  const now = formatDate(new Date().toISOString());
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@rah`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RAH//Appointment//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${timezone}:${dtStart}`,
    `DTEND;TZID=${timezone}:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`
  ];

  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }
  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }

  lines.push(
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete do agendamento",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  );

  return Buffer.from(lines.join("\r\n"), "utf-8");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
