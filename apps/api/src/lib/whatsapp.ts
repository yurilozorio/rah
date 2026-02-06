import { startBoss } from "./boss.js";

export type WhatsAppLocationData = {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
};

export type WhatsAppCalendarData = {
  title: string;
  startAt: string; // ISO string
  endAt: string;   // ISO string
  location?: string;
  description?: string;
  timezone: string;
  caption?: string;
};

/**
 * Queue a WhatsApp message to be sent by the worker via Baileys.
 * Supports sending a text message, optionally followed by a location card
 * and/or a .ics calendar file attachment.
 */
export const queueWhatsAppMessage = async (params: {
  phone: string;
  message: string;
  appointmentId?: string;
  eventType?: string;
  location?: WhatsAppLocationData;
  calendar?: WhatsAppCalendarData;
}): Promise<void> => {
  const boss = await startBoss();
  const jobId = await boss.send("send-whatsapp", params);
  // eslint-disable-next-line no-console
  console.log(`[whatsapp] Queued send-whatsapp job: ${jobId}`);
};
