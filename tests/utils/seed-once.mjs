// Set the seeded account's password to better-auth's hash of the dev UI's DEV_PASSWORD ("dev-pw").
// Format/params copied from @better-auth/utils/password: scrypt(NFKC(pw), hexSaltString, {N:16384,r:16,p:1,dkLen:64}) -> `${hexSalt}:${hexKey}`.
import Database from "better-sqlite3";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const scryptAsync = promisify(scrypt);
const DEV_PASSWORD = "dev-pw";

const D1_DIR = resolve(import.meta.dirname, "../../src/web/.wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const file = readdirSync(D1_DIR).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
const db = new Database(join(D1_DIR, file));
db.pragma("busy_timeout = 5000");

const saltHex = randomBytes(16).toString("hex");
// @better-auth/utils passes the hex *string* as the salt; node:crypto utf-8-encodes string inputs.
const key = await scryptAsync(DEV_PASSWORD.normalize("NFKC"), saltHex, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 });
const hash = `${saltHex}:${Buffer.from(key).toString("hex")}`;

const info = db.prepare(`UPDATE account SET password = ? WHERE providerId = 'credential'`).run(hash);
db.close();
console.log(JSON.stringify({ updatedRows: info.changes, password: DEV_PASSWORD }, null, 2));
