import { formatInTimeZone } from "date-fns-tz";

type CalendarEvent = {
  title: string;
  startAt: Date;
  endAt: Date;
  location?: string;
  description?: string;
  timezone: string;
};

/**
 * Generate a Google Calendar link for adding an event.
 * The link opens Google Calendar with pre-filled event details.
 */
export const generateGoogleCalendarLink = (event: CalendarEvent): string => {
  const { title, startAt, endAt, location, description, timezone } = event;
  
  // Format dates in the required format: YYYYMMDDTHHMMSS
  // Google Calendar expects dates in the event's local timezone
  const formatDate = (date: Date) => formatInTimeZone(date, timezone, "yyyyMMdd'T'HHmmss");
  
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatDate(startAt)}/${formatDate(endAt)}`,
    ctz: timezone
  });
  
  if (location) {
    params.set("location", location);
  }
  
  if (description) {
    params.set("details", description);
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Generate an ICS (iCalendar) data URL for downloading/adding to any calendar app.
 * This creates a data: URL that can be opened to download the .ics file.
 */
export const generateICSDataUrl = (event: CalendarEvent): string => {
  const { title, startAt, endAt, location, description } = event;
  
  // ICS format requires UTC times in YYYYMMDDTHHMMSSZ format
  const formatUTC = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2)}@appointment`;
  const now = formatUTC(new Date());
  
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Appointment System//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatUTC(startAt)}`,
    `DTEND:${formatUTC(endAt)}`,
    `SUMMARY:${escapeICS(title)}`
  ];
  
  if (location) {
    lines.push(`LOCATION:${escapeICS(location)}`);
  }
  
  if (description) {
    lines.push(`DESCRIPTION:${escapeICS(description)}`);
  }
  
  lines.push("END:VEVENT", "END:VCALENDAR");
  
  const icsContent = lines.join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
};

/**
 * Escape special characters for ICS format
 */
const escapeICS = (text: string): string => {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
};
