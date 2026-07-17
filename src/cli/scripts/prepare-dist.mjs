import { readFileSync, writeFileSync, chmodSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const shebang = "#!/usr/bin/env node\n";

function prepareEntry(relPath) {
  const entry = resolve(relPath);
  if (!existsSync(entry)) {
    console.warn("skip missing", entry);
    return;
  }
  const src = readFileSync(entry, "utf8");
  if (!src.startsWith(shebang)) {
    writeFileSync(entry, shebang + src);
  }
  chmodSync(entry, 0o755);
  console.log("prepared", entry);
}

prepareEntry("dist/index.js");
prepareEntry("dist/web-brain-mcp.js");

const rootLicense = resolve("../../LICENSE");
const packageLicense = resolve("LICENSE");
copyFileSync(rootLicense, packageLicense);
console.log("copied", rootLicense, "->", packageLicense);
