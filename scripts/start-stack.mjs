#!/usr/bin/env node
/**
 * Run Express + Python data-platform together so boards never start empty
 * because only one process was launched.
 *
 * Usage:
 *   node scripts/start-stack.mjs          # production (build artifacts + uvicorn)
 *   node scripts/start-stack.mjs --dev    # npm run dev + uvicorn --reload
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isDev = process.argv.includes("--dev");
const children = [];

function run(name, command, args, opts = {}) {
  const child = spawn(command, args, {
    cwd: opts.cwd || root,
    env: { ...process.env, ...opts.env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[stack] ${name} exited (code=${code}, signal=${signal}) — shutting down stack`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 1500).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const pyEnv = {
  PYTHONPATH: ".",
  ENABLE_SCHEDULER: process.env.ENABLE_SCHEDULER || "true",
  BOOTSTRAP_NBA_SYNC: process.env.BOOTSTRAP_NBA_SYNC || "true",
};

const pythonBin = process.env.PYTHON || "python3";
console.log(`[stack] starting data-platform :8000 (${isDev ? "reload" : "prod"}) via ${pythonBin}`);
run(
  "data-platform",
  pythonBin,
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "0.0.0.0",
    "--port",
    "8000",
    ...(isDev ? ["--reload"] : []),
  ],
  { cwd: path.join(root, "data-platform"), env: pyEnv },
);

console.log(`[stack] starting app :${process.env.PORT || 5000} (${isDev ? "dev" : "prod"})`);
if (isDev) {
  run("app", "npm", ["run", "dev"]);
} else {
  run("app", "node", ["--env-file=.env", "dist/index.cjs"]);
}
