import "dotenv/config";
import PgBoss from "pg-boss";
import { formatInTimeZone } from "date-fns-tz";
import { PrismaClient } from "@rah/db";
import { config } from "./lib/config.js";
import { sendWhatsAppTemplate } from "./lib/whatsapp.js";

const prisma = new PrismaClient();

const boss = new PgBoss({
  connectionString: config.DATABASE_URL,
  schema: "pgboss"
});

await boss.start();

boss.work("appointment-reminder", async (job) => {
  const appointmentId = job.data?.appointmentId as string | undefined;
  if (!appointmentId) return;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true }
  });

  if (!appointment || appointment.status === "CANCELLED") {
    return;
  }

  if (!config.WHATSAPP_TEMPLATE_REMINDER) {
    return;
  }

  const dateLabel = formatInTimeZone(appointment.startAt, config.TIMEZONE, "dd/MM/yyyy");
  const timeLabel = formatInTimeZone(appointment.startAt, config.TIMEZONE, "HH:mm");

  try {
    await sendWhatsAppTemplate(appointment.user.phone, config.WHATSAPP_TEMPLATE_REMINDER, [
      { type: "text", text: appointment.user.name },
      { type: "text", text: appointment.serviceName },
      { type: "text", text: dateLabel },
      { type: "text", text: timeLabel }
    ]);

    await prisma.appointmentEvent.create({
      data: {
        appointmentId: appointment.id,
        type: "REMINDER_SENT"
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to send reminder", error);
  }
});

process.on("SIGINT", async () => {
  await boss.stop();
  await prisma.$disconnect();
  process.exit(0);
});
