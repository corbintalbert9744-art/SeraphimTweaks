import { defineConfig } from "drizzle-kit";

/** Allow generate without a live DB; push/migrate still need DATABASE_URL. */
const url =
  process.env.DATABASE_URL ||
  "postgresql://seraphim:seraphim@localhost:5432/seraphim_analytics";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
