import "dotenv/config";
import PgBoss from "pg-boss";
import { formatInTimeZone } from "date-fns-tz";
import { PrismaClient, AppointmentEventType } from "@rah/db";
import { config } from "./lib/config.js";
import { sendWhatsAppMessage } from "./lib/whatsapp.js";
import { initBaileys } from "./lib/baileys.js";
import { fetchNotificationSettings } from "./lib/strapi.js";

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
  const { phone, message, appointmentId, eventType } = job.data ?? {};
  if (!phone || !message) return;

  const result = await sendWhatsAppMessage(phone, message);

  if ("failed" in result) {
    // eslint-disable-next-line no-console
    console.log(`WhatsApp send failed to ${phone} (reason: ${result.reason})`);
    return;
  }

  if ("success" in result && appointmentId && eventType) {
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
  const result = await sendWhatsAppMessage(appointment.user.phone, message);

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

process.on("SIGINT", async () => {
  await boss.stop();
  await prisma.$disconnect();
  process.exit(0);
});
