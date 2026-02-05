import { getBoss, startBoss } from "./boss.js";

/**
 * Queue a WhatsApp message to be sent by the worker via Baileys.
 * This is fire-and-forget from the API's perspective.
 *
 * @param phone - Phone number with country code (e.g. "5527996975347")
 * @param message - Text message to send
 * @param appointmentId - Optional appointment ID for event logging
 * @param eventType - Optional event type (e.g. "CONFIRMATION_SENT") to log on success
 */
export const queueWhatsAppMessage = async (
  phone: string,
  message: string,
  appointmentId?: string,
  eventType?: string
): Promise<void> => {
  const boss = await startBoss();
  const jobId = await boss.send("send-whatsapp", {
    phone,
    message,
    appointmentId,
    eventType
  });
  // eslint-disable-next-line no-console
  console.log(`[whatsapp] Queued send-whatsapp job: ${jobId}`);
};
