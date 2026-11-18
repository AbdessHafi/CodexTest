import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
if (process.env.NODE_ENV === "production")
  throw new Error("Mode local seulement.");
const url = new URL(process.env.DATABASE_URL || "postgresql://invalid/");
if (!["localhost", "127.0.0.1", "db"].includes(url.hostname))
  throw new Error("Base locale dédiée requise.");
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "development",
  DEMO_SESSION_SECRET: randomBytes(32).toString("hex"),
  DEMO_MODE: "false",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54329",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-development-public-key",
  MAIL_TRANSPORT: "local",
  CAPTCHA_MODE: "disabled",
  S3_ENDPOINT: "http://127.0.0.1:54329",
  S3_BUCKET: "local-private",
  S3_REGION: "eu-west-3",
  S3_ACCESS_KEY_ID: "local-development",
  S3_SECRET_ACCESS_KEY: "local-development",
};
const seed = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/seed-owner.ts"],
  { env, stdio: "inherit" },
);
await new Promise<void>((resolve, reject) =>
  seed.once("exit", (code) =>
    code === 0 ? resolve() : reject(new Error("Seed local impossible.")),
  ),
);
const auth = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/demo-auth.ts"],
  { env, stdio: "inherit" },
);
const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"],
  { env, stdio: "inherit" },
);
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  auth.kill("SIGTERM");
  app.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
auth.on("exit", stop);
app.on("exit", stop);
