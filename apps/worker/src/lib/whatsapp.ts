import { config } from "./config.js";

type TemplateParameter = {
  type: "text";
  text: string;
};

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
