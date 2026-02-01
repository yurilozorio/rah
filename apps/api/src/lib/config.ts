import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  STRAPI_URL: z.string(),
  STRAPI_API_TOKEN: z.string(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_TEMPLATE_CONFIRMATION: z.string().optional(),
  WHATSAPP_TEMPLATE_REMINDER: z.string().optional(),
  TIMEZONE: z.string().default("America/Sao_Paulo"),
  BUSINESS_START_MIN: z.string().default("540"),
  BUSINESS_END_MIN: z.string().default("1140")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const config = {
  ...parsed.data,
  port: Number(parsed.data.PORT),
  businessStartMin: Number(parsed.data.BUSINESS_START_MIN),
  businessEndMin: Number(parsed.data.BUSINESS_END_MIN)
};
