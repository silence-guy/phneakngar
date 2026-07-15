#!/usr/bin/env node
/**
 * Prepare @phneakngar/app package artifacts after Bun builds dist/index.js.
 */
import { chmodSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const entry = resolve("dist/index.js");
const src = readFileSync(entry, "utf8");
const shebang = "#!/usr/bin/env node\n";
if (!src.startsWith(shebang)) {
  writeFileSync(entry, shebang + src);
}
chmodSync(entry, 0o755);
console.log("prepared", entry);

const rootLicense = resolve("../../LICENSE");
const packageLicense = resolve("LICENSE");
copyFileSync(rootLicense, packageLicense);
console.log("copied", rootLicense, "->", packageLicense);
