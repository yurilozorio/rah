import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";

export const registerLoyaltyRoutes = (app: FastifyInstance) => {
  app.get("/loyalty", { preHandler: app.authenticate }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id }
    });

    const ledger = await prisma.loyaltyLedger.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return {
      points: user?.loyaltyPoints ?? 0,
      ledger
    };
  });
};
