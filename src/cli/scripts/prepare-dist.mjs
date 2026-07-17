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

// bun build of bin-mcp.ts emits dist/bin-mcp.js (entry basename) even when
// --outfile web-brain-mcp.js is set; normalize the MCP entry name for wire-mcp.
const binMcp = resolve("dist/bin-mcp.js");
const webBrainMcp = resolve("dist/web-brain-mcp.js");
if (existsSync(binMcp)) {
  copyFileSync(binMcp, webBrainMcp);
  console.log("copied", binMcp, "->", webBrainMcp);
}
prepareEntry("dist/web-brain-mcp.js");

const rootLicense = resolve("../../LICENSE");
const packageLicense = resolve("LICENSE");
copyFileSync(rootLicense, packageLicense);
console.log("copied", rootLicense, "->", packageLicense);
