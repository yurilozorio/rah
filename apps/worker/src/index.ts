import "dotenv/config";
import PgBoss from "pg-boss";
import { formatInTimeZone } from "date-fns-tz";
import { PrismaClient } from "@rah/db";
import { config } from "./lib/config.js";
import { sendWhatsAppText } from "./lib/whatsapp.js";
import { fetchNotificationSettings } from "./lib/strapi.js";

const prisma = new PrismaClient();

const boss = new PgBoss({
  connectionString: config.DATABASE_URL,
  schema: "pgboss"
});

await boss.start();

interface ReminderJobData {
  appointmentId?: string;
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

  // Send via WhatsApp session message
  const result = await sendWhatsAppText(appointment.user.phone, message);

  if ("skipped" in result) {
    // eslint-disable-next-line no-console
    console.log("WhatsApp credentials not configured, skipping");
    return;
  }

  if ("failed" in result) {
    // Session not active - this is expected for users who haven't messaged on WhatsApp
    // eslint-disable-next-line no-console
    console.log(`WhatsApp reminder failed (reason: ${result.reason}), skipping`);
    return;
  }

  // Log success
  await prisma.appointmentEvent.create({
    data: {
      appointmentId: appointment.id,
      type: "REMINDER_SENT"
    }
  });
  
  // eslint-disable-next-line no-console
  console.log(`Reminder sent for appointment ${appointmentId}`);
});

process.on("SIGINT", async () => {
  await boss.stop();
  await prisma.$disconnect();
  process.exit(0);
});
