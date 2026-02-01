import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { verifyPassword } from "../lib/auth.js";

// Admin login schema - email + password
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const registerAuthRoutes = (app: FastifyInstance) => {
  // Admin-only login with email + password
  app.post("/auth/login", async (request, reply) => {
    const data = loginSchema.parse(request.body);
    const email = data.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    // Verify password
    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    // Only allow admin users to login
    if (user.role !== "ADMIN") {
      return reply.code(403).send({ message: "Admin access required" });
    }

    const token = app.jwt.sign({ id: user.id, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    };
  });

  // Get current admin user info
  app.get("/me", { preHandler: app.authenticate }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id }
    });

    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      : null;
  });

  app.post("/auth/logout", async () => ({ ok: true }));
};
