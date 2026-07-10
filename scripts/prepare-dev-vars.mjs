import { randomBytes } from "node:crypto";
import { chmod, copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const files = {
  web: resolve(root, "src/web/.dev.vars"),
  webExample: resolve(root, "src/web/.dev.vars.example"),
  email: resolve(root, "src/email-worker/.dev.vars"),
  emailExample: resolve(root, "src/email-worker/.dev.vars.example"),
  ws: resolve(root, "src/ws-do/.dev.vars"),
  wsExample: resolve(root, "src/ws-do/.dev.vars.example"),
};

function randomSecret() {
  return randomBytes(32).toString("base64url");
}

function readValue(text, key) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function setValue(text, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, `${key}=${value}`);
  return `${text.replace(/\s*$/, "")}\n${key}=${value}\n`;
}

async function ensureFile(target, example) {
  if (!existsSync(target)) await copyFile(example, target);
  await chmod(target, 0o600).catch(() => {});
  return readFile(target, "utf8");
}

function synchronizeSecret(text, key, expected, label) {
  const current = readValue(text, key);
  if (current && current !== expected) {
    throw new Error(`${label} ${key} does not match src/web/.dev.vars`);
  }
  return setValue(text, key, expected);
}

let web = await ensureFile(files.web, files.webExample);
for (const key of ["BETTER_AUTH_SECRET", "ENCRYPTION_KEY", "EMAIL_NOTIFY_SECRET", "WS_SERVICE_SECRET"]) {
  if (!readValue(web, key)) web = setValue(web, key, randomSecret());
}
await writeFile(files.web, web, { mode: 0o600 });

let email = await ensureFile(files.email, files.emailExample);
email = synchronizeSecret(email, "ENCRYPTION_KEY", readValue(web, "ENCRYPTION_KEY"), "email-worker");
email = synchronizeSecret(email, "EMAIL_NOTIFY_SECRET", readValue(web, "EMAIL_NOTIFY_SECRET"), "email-worker");
if (!readValue(email, "WEB_ORIGIN")) email = setValue(email, "WEB_ORIGIN", "http://localhost:3000");
await writeFile(files.email, email, { mode: 0o600 });

let ws = await ensureFile(files.ws, files.wsExample);
ws = synchronizeSecret(ws, "WS_SERVICE_SECRET", readValue(web, "WS_SERVICE_SECRET"), "ws-do");
await writeFile(files.ws, ws, { mode: 0o600 });

console.log("Local Worker variable files are ready. OAuth credentials remain operator-supplied.");
