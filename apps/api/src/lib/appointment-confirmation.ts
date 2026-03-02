import { formatInTimeZone } from "date-fns-tz";
import { config } from "./config.js";
import { queueWhatsAppMessage } from "./whatsapp.js";
import { type ContactInfo, type NotificationSettings } from "./strapi.js";

const BRAZIL_COUNTRY_CODE = "55";

/**
 * Normalize phone number: remove non-digits and add Brazil country code if needed.
 * Users enter DDD + number (e.g., 27996975347), we prepend 55 for WhatsApp.
 */
export function normalizePhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");

  // If already starts with 55 and has the right length (12+ digits), keep as is
  if (digitsOnly.startsWith(BRAZIL_COUNTRY_CODE) && digitsOnly.length >= 12) {
    return digitsOnly;
  }

  // Otherwise, prepend Brazil country code
  return `${BRAZIL_COUNTRY_CODE}${digitsOnly}`;
}

/**
 * Returns lookup variants for legacy compatibility:
 * - canonical format (always with country code 55)
 * - local format (without 55), if applicable
 */
export function getPhoneLookupVariants(phone: string): string[] {
  const normalized = normalizePhoneNumber(phone);
  const variants = new Set<string>([normalized]);

  if (normalized.startsWith(BRAZIL_COUNTRY_CODE) && normalized.length > BRAZIL_COUNTRY_CODE.length) {
    variants.add(normalized.slice(BRAZIL_COUNTRY_CODE.length));
  }

  return Array.from(variants);
}

type ComposeMessageParams = {
  template: string;
  name: string;
  services: string;
  date: string;
  time: string;
  totalDuration: number;
  totalPrice: number;
};

function composeMessage(params: ComposeMessageParams): string {
  const { template, name, services, date, time, totalDuration, totalPrice } = params;

  return template
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{services\}\}/g, services)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{totalDuration\}\}/g, String(totalDuration))
    .replace(/\{\{totalPrice\}\}/g, totalPrice.toFixed(2).replace(".", ","));
}

export async function queueAppointmentConfirmationMessage(params: {
  phone: string;
  userName: string;
  services: Array<{ name: string; durationMinutes: number; price: number }>;
  startAt: Date;
  endAt: Date;
  appointmentId: string;
  notificationSettings: NotificationSettings | null;
  contactInfo: ContactInfo | null;
  log: { info: (msg: any, ...args: any[]) => void };
}): Promise<void> {
  const {
    phone,
    userName,
    services,
    startAt,
    endAt,
    appointmentId,
    notificationSettings,
    contactInfo,
    log
  } = params;

  if (!notificationSettings?.confirmationMessageTemplate) {
    log.info("No confirmation template configured, skipping WhatsApp");
    return;
  }

  const dateLabel = formatInTimeZone(startAt, config.TIMEZONE, "dd/MM/yyyy");
  const timeLabel = formatInTimeZone(startAt, config.TIMEZONE, "HH:mm");
  const serviceNames = services.map((service) => service.name).join(", ");
  const totalDuration = services.reduce((sum, service) => sum + service.durationMinutes, 0);
  const totalPrice = services.reduce((sum, service) => sum + service.price, 0);

  const message = composeMessage({
    template: notificationSettings.confirmationMessageTemplate,
    name: userName,
    services: serviceNames,
    date: dateLabel,
    time: timeLabel,
    totalDuration,
    totalPrice
  });

  const locationData =
    notificationSettings.businessLatitude && notificationSettings.businessLongitude
      ? {
          latitude: Number(notificationSettings.businessLatitude),
          longitude: Number(notificationSettings.businessLongitude),
          name: notificationSettings.businessName,
          address: contactInfo?.address ?? ""
        }
      : undefined;

  const calendarData = {
    title: `Agendamento - ${notificationSettings.businessName}`,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    location: contactInfo?.address ?? undefined,
    description: `Procedimentos: ${serviceNames}`,
    timezone: config.TIMEZONE,
    caption: notificationSettings.calendarCaption ?? undefined
  };

  await queueWhatsAppMessage({
    phone,
    message,
    appointmentId,
    eventType: "CONFIRMATION_SENT",
    location: locationData,
    calendar: calendarData
  });
  log.info({ phone, appointmentId }, "WhatsApp confirmation queued");
}
