import { config } from "./config.js";

type TemplateParameter = {
  type: "text";
  text: string;
};

type WhatsAppTextResult = 
  | { skipped: true }
  | { failed: true; reason: "no_session" | "unknown"; error?: string }
  | { success: true; messageId: string };

export const sendWhatsAppTemplate = async (to: string, templateName: string, parameters: TemplateParameter[]) => {
  if (!config.WHATSAPP_ACCESS_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) {
    return { skipped: true };
  }

  const url = `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "pt_BR"
        },
        components: [
          {
            type: "body",
            parameters
          }
        ]
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${body}`);
  }

  return response.json();
};

/**
 * Send a free-form text message via WhatsApp.
 * This only works within 24 hours of the user's last message (session window).
 * If no session exists, returns { failed: true, reason: "no_session" } instead of throwing.
 */
export const sendWhatsAppText = async (to: string, message: string): Promise<WhatsAppTextResult> => {
  if (!config.WHATSAPP_ACCESS_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) {
    return { skipped: true };
  }

  const url = `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: message
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    
    // Check for session/window errors (error code 131047 = re-engagement message, 131026 = message failed)
    // These indicate the user hasn't initiated conversation or session expired
    if (body.includes("131047") || body.includes("131026") || body.includes("Re-engagement message")) {
      return { failed: true, reason: "no_session", error: body };
    }
    
    return { failed: true, reason: "unknown", error: body };
  }

  const result = await response.json();
  return { success: true, messageId: result.messages?.[0]?.id };
};
