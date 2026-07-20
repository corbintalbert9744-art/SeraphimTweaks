import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDb() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL!.replace(/^postgres:\/\//, "postgresql://");
    const local =
      connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    pool = new Pool({
      connectionString,
      // Render / managed Postgres require TLS; local Docker usually does not.
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

export type Db = ReturnType<typeof getDb>;
