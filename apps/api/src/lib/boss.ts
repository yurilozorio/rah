import PgBoss from "pg-boss";
import { config } from "./config.js";

let boss: PgBoss | null = null;
let bossStarted = false;

export const getBoss = () => {
  if (!boss) {
    boss = new PgBoss({
      connectionString: config.DATABASE_URL,
      schema: "pgboss"
    });
  }
  return boss;
};

export const startBoss = async () => {
  const instance = getBoss();
  if (!bossStarted) {
    await instance.start();
    // Ensure all required queues exist (pg-boss v10 requires explicit queue creation)
    await instance.createQueue("appointment-reminder");
    await instance.createQueue("send-whatsapp");
    bossStarted = true;
  }
  return instance;
};
