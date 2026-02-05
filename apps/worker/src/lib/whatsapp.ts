import { sendBaileysMessage, isBaileysReady } from "./baileys.js";

export type WhatsAppResult =
  | { skipped: true }
  | { failed: true; reason: string }
  | { success: true; messageId: string };

/**
 * Send a text message via WhatsApp using Baileys.
 * @param to - Phone number with country code (e.g. "5527996975347")
 * @param message - Text message to send
 */
export const sendWhatsAppMessage = async (to: string, message: string): Promise<WhatsAppResult> => {
  if (!isBaileysReady()) {
    return { failed: true, reason: "not_connected" };
  }

  return sendBaileysMessage(to, message);
};
