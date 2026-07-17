#!/usr/bin/env node
/**
 * Fail if package.json pulls forbidden heavy deps or if node_modules subtree is huge.
 * Zero-dep package should stay well under 30 MB install delta.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));

const FORBIDDEN = [
  "wigolo",
  "onnxruntime",
  "onnxruntime-node",
  "onnxruntime-web",
  "@huggingface/transformers",
  "fastembed",
  "sqlite-vec",
  "playwright",
  "playwright-core",
  "wreq-js",
];

function collectDepNames(obj = {}) {
  return Object.keys(obj);
}

const allDeps = [
  ...collectDepNames(pkg.dependencies),
  ...collectDepNames(pkg.optionalDependencies),
  ...collectDepNames(pkg.peerDependencies),
];

const bad = allDeps.filter((d) =>
  FORBIDDEN.some((f) => d === f || d.startsWith(f + "/") || d.includes(f)),
);

let failed = false;
if (bad.length) {
  console.error("FORBIDDEN deps in @phneakngar/web-brain:", bad.join(", "));
  failed = true;
} else {
  console.log("OK: no forbidden heavy deps in package.json");
  console.log("dependencies:", allDeps.length ? allDeps.join(", ") : "(none)");
}

const nm = join(root, "node_modules");
function dirSize(p) {
  let total = 0;
  if (!existsSync(p)) return 0;
  const st = statSync(p);
  if (st.isFile()) return st.size;
  for (const name of readdirSync(p)) {
    if (name === ".bin") continue;
    total += dirSize(join(p, name));
  }
  return total;
}

if (existsSync(nm)) {
  const bytes = dirSize(nm);
  const mb = bytes / (1024 * 1024);
  console.log(`node_modules size: ${mb.toFixed(2)} MB`);
  const MAX_MB = 30;
  if (mb > MAX_MB) {
    console.error(`FAIL: node_modules ${mb.toFixed(2)} MB exceeds ${MAX_MB} MB budget`);
    failed = true;
  } else {
    console.log(`OK: within ${MAX_MB} MB budget`);
  }
} else {
  console.log("node_modules absent (zero runtime deps expected) — OK");
}

// Source tree should be tiny
const srcBytes = dirSize(join(root, "src"));
console.log(`src size: ${(srcBytes / 1024).toFixed(1)} KB`);

process.exit(failed ? 1 : 0);
