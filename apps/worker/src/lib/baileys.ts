import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  Browsers,
  ConnectionState
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import { config } from "./config.js";

const logger = pino({ level: "warn" });

let sock: WASocket | null = null;
let connectionReady = false;

/**
 * Initialize the Baileys WhatsApp client.
 * On first run, prints a QR code in the terminal for pairing.
 * Auth state is persisted to disk so subsequent starts reconnect automatically.
 */
export async function initBaileys(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(config.BAILEYS_AUTH_DIR);

  const connectToWhatsApp = async () => {
    sock = makeWASocket({
      auth: state,
      logger,
      browser: Browsers.ubuntu("RAH Worker"),
      markOnlineOnConnect: false
    });

    sock.ev.on("connection.update", (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      // Print QR code when received (first-time pairing)
      if (qr) {
        // eslint-disable-next-line no-console
        console.log("\n========================================");
        // eslint-disable-next-line no-console
        console.log("Scan this QR code with WhatsApp:");
        // eslint-disable-next-line no-console
        console.log("Phone > Settings > Linked Devices > Link a Device");
        // eslint-disable-next-line no-console
        console.log("========================================\n");
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === "close") {
        connectionReady = false;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        // eslint-disable-next-line no-console
        console.log(
          `Baileys connection closed (status: ${statusCode}), reconnecting: ${shouldReconnect}`
        );

        if (shouldReconnect) {
          // Reconnect after a short delay
          setTimeout(() => connectToWhatsApp(), 3000);
        } else {
          // eslint-disable-next-line no-console
          console.error(
            "Baileys logged out. Delete the auth folder and restart to re-scan QR code."
          );
        }
      } else if (connection === "open") {
        connectionReady = true;
        // eslint-disable-next-line no-console
        console.log("Baileys WhatsApp connection opened successfully");
      }
    });

    sock.ev.on("creds.update", saveCreds);
  };

  await connectToWhatsApp();
}

/**
 * Check if the Baileys connection is ready.
 */
export function isBaileysReady(): boolean {
  return connectionReady && sock !== null;
}

/**
 * Send a text message via Baileys.
 * @param phone - Phone number in format "5527996975347" (digits only, with country code)
 * @param message - Text message to send
 * @returns Object indicating success or failure
 */
export async function sendBaileysMessage(
  phone: string,
  message: string
): Promise<{ success: true; messageId: string } | { failed: true; reason: string }> {
  if (!sock || !connectionReady) {
    return { failed: true, reason: "not_connected" };
  }

  const jid = `${phone}@s.whatsapp.net`;

  try {
    const result = await sock.sendMessage(jid, { text: message });
    const messageId = result?.key?.id ?? "unknown";
    return { success: true, messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`Baileys send failed to ${phone}: ${errorMessage}`);
    return { failed: true, reason: errorMessage };
  }
}
