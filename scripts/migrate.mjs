#!/usr/bin/env node
/** Apply SQL migrations against DATABASE_URL (Render / Docker / local Postgres). */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const dir = path.join(root, "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const pool = new pg.Pool({
  connectionString: url.replace(/^postgres:\/\//, "postgresql://"),
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const client = await pool.connect();
try {
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    console.log(`[migrate] applying ${file}`);
    await client.query(sql);
  }
  console.log("[migrate] done");
} finally {
  client.release();
  await pool.end();
}
