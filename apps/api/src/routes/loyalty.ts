import { FastifyInstance } from "fastify";

export const registerLoyaltyRoutes = (app: FastifyInstance) => {
  // Loyalty feature not yet implemented - return empty data
  app.get("/loyalty", { preHandler: app.authenticate }, async () => {
    return {
      points: 0,
      ledger: []
    };
  });
};
