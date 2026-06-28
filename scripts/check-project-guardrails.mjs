#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const ignoredDirs = new Set([
  ".git",
  ".next",
  ".turbo",
  ".wrangler",
  "dist",
  "node_modules",
]);

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".kt",
  ".md",
  ".mjs",
  ".mm",
  ".rs",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const full = path.join(dir, entry);
    const rel = path.relative(root, full);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (textExtensions.has(path.extname(entry)) || entry.startsWith(".")) {
      files.push(rel);
    }
  }
  return files;
}

function fail(message) {
  failures.push(message);
}

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const files = walk(root);
const legacySlug = String.fromCharCode(97, 108, 111, 111, 107);
const legacyBrand = `${legacySlug[0].toUpperCase()}${legacySlug.slice(1)}`;
const legacyEnv = legacySlug.toUpperCase();
const legacyScope = `@${legacySlug}`;
const legacyPattern = new RegExp(`(${legacyBrand}|${legacyEnv}|${legacySlug}|${legacyScope})`);
const legacyPathPattern = new RegExp(legacySlug, "i");
const khmerHeaderPrefix = `X-${"ភ្នាក់ងារ"}`;

for (const rel of files) {
  const normalized = rel.split(path.sep).join("/");
  if (legacyPathPattern.test(normalized)) {
    fail(`legacy name in path: ${normalized}`);
  }

  const text = read(rel);
  if (legacyPattern.test(text)) {
    fail(`legacy brand text in ${normalized}`);
  }
  if (/src\/shared\/src\/schema\.ts|src\/shared\/src\/queries/.test(text)) {
    fail(`stale shared DB path in ${normalized}`);
  }
  if (text.includes(khmerHeaderPrefix)) {
    fail(`non-ASCII protocol header in ${normalized}`);
  }
  if (/[A-Za-z0-9_]ភ្នាក់ងារ|ភ្នាក់ងារ[A-Za-z0-9_]/.test(text)) {
    fail(`mixed Khmer/ASCII identifier in ${normalized}`);
  }
}

const requiredDocs = [
  "docs/source-map.md",
  "docs/data-and-state-boundaries.md",
  "docs/migrations.md",
  "docs/release-checklist.md",
];

for (const rel of requiredDocs) {
  if (!existsSync(path.join(root, rel))) {
    fail(`missing guardrail doc: ${rel}`);
  }
}

const packageFiles = [
  "src/shared/package.json",
  "src/web/package.json",
  "src/cli/package.json",
  "src/email-worker/package.json",
  "src/ws-do/package.json",
  "src/app/package.json",
  "src/desktop/package.json",
  "tests/utils/package.json",
];

for (const rel of packageFiles) {
  const pkg = JSON.parse(read(rel));
  if (!pkg.name?.startsWith("@phneakngar/")) {
    fail(`${rel} package name must use @phneakngar/*`);
  }
}

const rootPkg = JSON.parse(read("package.json"));
if (rootPkg.name !== "phneakngar") {
  fail("root package name must be phneakngar");
}
if (!rootPkg.scripts?.["check:project"]) {
  fail("package.json must expose check:project");
}
if (!rootPkg.scripts?.["dev:cli"]?.includes("PHNEAKNGAR_SERVER_URL=http://localhost:15210")) {
  fail("package.json dev:cli must target the local web port at http://localhost:15210");
}
if (!rootPkg.scripts?.["dev:cli"]?.includes("PHNEAKNGAR_WS_DO_PORT=15212")) {
  fail("package.json dev:cli must target the local WebSocket DO port 15212");
}

for (const rel of files.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))) {
  if (!rel.startsWith("src/web/src/")) continue;
  const lines = read(rel).split("\n");
  lines.forEach((line, idx) => {
    if (line.includes("overflow-auto")) {
      fail(`${rel}:${idx + 1} uses overflow-auto; prefer overflow-x-auto or overflow-y-auto with thin-scrollbar`);
    }
    if (/(overflow-x-auto|overflow-y-auto)/.test(line) && !line.includes("thin-scrollbar")) {
      fail(`${rel}:${idx + 1} uses overflow-x/y-auto without thin-scrollbar`);
    }
  });
}

if (failures.length > 0) {
  console.error("Project guardrail check failed:");
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Project guardrail check passed.");
