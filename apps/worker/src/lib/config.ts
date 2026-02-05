import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  STRAPI_URL: z.string(),
  STRAPI_API_TOKEN: z.string(),
  BAILEYS_AUTH_DIR: z.string().default("./baileys-auth"),
  TIMEZONE: z.string().default("America/Sao_Paulo")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const config = parsed.data;
