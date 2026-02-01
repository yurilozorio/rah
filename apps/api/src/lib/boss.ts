import PgBoss from "pg-boss";
import { config } from "./config.js";

let boss: PgBoss | null = null;

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
  if (!instance.isStarted) {
    await instance.start();
  }
  return instance;
};
