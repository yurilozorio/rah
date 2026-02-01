import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { config } from "./lib/config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAvailabilityRoutes } from "./routes/availability.js";
import { registerAppointmentRoutes } from "./routes/appointments.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerLoyaltyRoutes } from "./routes/loyalty.js";
import { startBoss } from "./lib/boss.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true
});

await app.register(jwt, {
  secret: config.JWT_SECRET
});

app.decorate("authenticate", async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (error) {
    reply.code(401).send({ message: "Unauthorized" });
  }
});

app.decorate("requireAdmin", async (request, reply) => {
  await app.authenticate(request, reply);
  if (reply.sent) return;
  const payload = request.user as { role?: string };
  if (payload?.role !== "ADMIN") {
    reply.code(403).send({ message: "Forbidden" });
  }
});

app.get("/health", async () => ({ ok: true }));

registerAuthRoutes(app);
registerAvailabilityRoutes(app);
registerAppointmentRoutes(app);
registerAdminRoutes(app);
registerLoyaltyRoutes(app);

await startBoss();

app.listen({ port: config.port, host: "0.0.0.0" });
