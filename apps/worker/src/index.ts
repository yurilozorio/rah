import "dotenv/config";
import PgBoss from "pg-boss";
import { formatInTimeZone } from "date-fns-tz";
import { PrismaClient, AppointmentEventType } from "@rah/db";
import { config } from "./lib/config.js";
import { sendBaileysMessage, sendBaileysLocation, sendBaileysDocument, isBaileysReady } from "./lib/whatsapp.js";
import { initBaileys } from "./lib/baileys.js";
import { fetchNotificationSettings } from "./lib/strapi.js";
import { generateIcsFile } from "./lib/ics.js";

const prisma = new PrismaClient();

const boss = new PgBoss({
  connectionString: config.DATABASE_URL,
  schema: "pgboss"
});

// Initialize Baileys before starting the job queue
// eslint-disable-next-line no-console
console.log("Initializing Baileys WhatsApp connection...");
await initBaileys();

await boss.start();

interface ReminderJobData {
  appointmentId?: string;
}

interface SendWhatsAppJobData {
  phone: string;
  message: string;
  appointmentId?: string;
  eventType?: string;
  location?: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  };
  calendar?: {
    title: string;
    startAt: string;
    endAt: string;
    location?: string;
    description?: string;
    timezone: string;
    caption?: string;
  };
}

// Helper to compose reminder message from template
function composeReminderMessage(params: {
  template: string;
  name: string;
  services: string;
  date: string;
  time: string;
}): string {
  const { template, name, services, date, time } = params;
  
  return template
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{services\}\}/g, services)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time);
}

// Handler for immediate WhatsApp messages (confirmations, etc.)
boss.work<SendWhatsAppJobData>("send-whatsapp", { batchSize: 1 }, async ([job]) => {
  const { phone, message, appointmentId, eventType, location, calendar } = job.data ?? {};
  if (!phone || !message) return;

  if (!isBaileysReady()) {
    // eslint-disable-next-line no-console
    console.log(`WhatsApp not connected, skipping send to ${phone}`);
    return;
  }

  // 1. Send text message
  const result = await sendBaileysMessage(phone, message);

  if ("failed" in result) {
    // eslint-disable-next-line no-console
    console.log(`WhatsApp text send failed to ${phone} (reason: ${result.reason})`);
    return;
  }

  // 2. Send native location card (if coordinates available)
  if (location) {
    const locResult = await sendBaileysLocation(phone, location);
    if ("failed" in locResult) {
      // eslint-disable-next-line no-console
      console.log(`WhatsApp location send failed to ${phone} (reason: ${locResult.reason})`);
    }
  }

  // 3. Send .ics calendar file (if calendar data available)
  if (calendar) {
    const icsBuffer = generateIcsFile(calendar);
    const docResult = await sendBaileysDocument(phone, {
      data: icsBuffer,
      mimetype: "text/calendar",
      fileName: "Agendamento.ics",
      caption: calendar.caption || undefined
    });
    if ("failed" in docResult) {
      // eslint-disable-next-line no-console
      console.log(`WhatsApp calendar send failed to ${phone} (reason: ${docResult.reason})`);
    }
  }

  // Log event on success
  if (appointmentId && eventType) {
    await prisma.appointmentEvent.create({
      data: {
        appointmentId,
        type: eventType as AppointmentEventType
      }
    });
    // eslint-disable-next-line no-console
    console.log(`WhatsApp ${eventType} sent to ${phone} for appointment ${appointmentId}`);
  }
});

// Handler for scheduled appointment reminders
boss.work<ReminderJobData>("appointment-reminder", { batchSize: 1 }, async ([job]) => {
  const appointmentId = job.data?.appointmentId;
  if (!appointmentId) return;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true }
  });

  if (!appointment || appointment.status === "CANCELLED") {
    return;
  }

  // Fetch notification settings from Strapi
  const notificationSettings = await fetchNotificationSettings();
  
  if (!notificationSettings?.reminderMessageTemplate) {
    // eslint-disable-next-line no-console
    console.log("No reminder template configured, skipping");
    return;
  }

  const dateLabel = formatInTimeZone(appointment.startAt, config.TIMEZONE, "dd/MM/yyyy");
  const timeLabel = formatInTimeZone(appointment.startAt, config.TIMEZONE, "HH:mm");

  // Compose the reminder message
  const message = composeReminderMessage({
    template: notificationSettings.reminderMessageTemplate,
    name: appointment.user.name,
    services: appointment.serviceName,
    date: dateLabel,
    time: timeLabel
  });

  // Send via Baileys
  const result = await sendBaileysMessage(appointment.user.phone, message);

  if ("failed" in result) {
    // eslint-disable-next-line no-console
    console.log(`WhatsApp reminder failed (reason: ${result.reason}), skipping`);
    return;
  }

  if ("success" in result) {
    // Log success
    await prisma.appointmentEvent.create({
      data: {
        appointmentId: appointment.id,
        type: "REMINDER_SENT"
      }
    });
    
    // eslint-disable-next-line no-console
    console.log(`Reminder sent for appointment ${appointmentId}`);
  }
});

// ============================================
// Promotion end-behavior cron job
// ============================================

async function checkExpiredPromotions() {
  const now = new Date();
  
  try {
    // Fetch ended promotions that are still active with deactivate behavior
    const url = new URL("/api/promotions", config.STRAPI_URL);
    url.searchParams.set("populate", "service");
    url.searchParams.set("filters[endDate][$lt]", now.toISOString());
    url.searchParams.set("filters[endBehavior][$eq]", "deactivate");
    url.searchParams.set("filters[active][$eq]", "true");
    url.searchParams.set("pagination[pageSize]", "100");

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.STRAPI_API_TOKEN}`
      }
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.log(`Failed to fetch promotions: ${response.status}`);
      return;
    }

    const json = await response.json();
    const promotions = json?.data ?? [];

    // eslint-disable-next-line no-console
    console.log(`Found ${promotions.length} ended deactivate promotion(s) to check`);

    for (const promo of promotions) {
      const attrs = promo?.attributes ?? promo;
      const promoId = promo.documentId ?? promo.id;
      const serviceData = attrs.service?.data ?? attrs.service;
      const serviceId = serviceData?.documentId ?? serviceData?.id;
      if (!serviceId) continue;

      try {
        // Unpublish the linked service
        const svcUrl = new URL(`/api/services/${serviceId}/unpublish`, config.STRAPI_URL);
        const svcRes = await fetch(svcUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.STRAPI_API_TOKEN}`
          }
        });
        // eslint-disable-next-line no-console
        console.log(`Unpublished service ${serviceId} (status: ${svcRes.status})`);

        // Deactivate the promotion so it won't be processed again
        const promoUrl = new URL(`/api/promotions/${promoId}`, config.STRAPI_URL);
        const promoRes = await fetch(promoUrl.toString(), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.STRAPI_API_TOKEN}`
          },
          body: JSON.stringify({ data: { active: false } })
        });
        // eslint-disable-next-line no-console
        console.log(`Deactivated promotion ${promoId} (status: ${promoRes.status})`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to process promotion ${promoId}:`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to check expired promotions:", error);
  }
}

// Schedule promotion check every 5 minutes
await boss.createQueue("check-expired-promotions");
await boss.schedule("check-expired-promotions", "*/5 * * * *", {}, { tz: config.TIMEZONE });

boss.work("check-expired-promotions", { batchSize: 1 }, async () => {
  await checkExpiredPromotions();
});

// Run once at startup
checkExpiredPromotions().catch(() => {});

process.on("SIGINT", async () => {
  await boss.stop();
  await prisma.$disconnect();
  process.exit(0);
});
