#!/usr/bin/env node
/**
 * Build, pack, install, and smoke-test @phneakngar/app from a clean directory.
 * Does not publish. Safe to run on a developer machine.
 *
 * Usage (from monorepo root):
 *   node scripts/verify-app-package.mjs
 */
import { execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const appDir = join(root, "src", "app");
const require = createRequire(join(appDir, "package.json"));
const pkg = require(join(appDir, "package.json"));

const packageEnv = {
  PHNEAKNGAR_DOMAIN: "phneakngar.invalid",
  NEXT_PUBLIC_PHNEAKNGAR_DOMAIN: "phneakngar.invalid",
  NEXT_PUBLIC_PHNEAKNGAR_ENVIRONMENT: "development",
};

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, {
    cwd: opts.cwd ?? root,
    stdio: "inherit",
    env: { ...process.env, ...packageEnv, ...opts.env },
  });
}

function runCapture(cmd, opts = {}) {
  const result = spawnSync(cmd, {
    cwd: opts.cwd ?? root,
    shell: true,
    encoding: "utf-8",
    env: { ...process.env, ...packageEnv, ...opts.env },
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): ${cmd}\n${result.stdout || ""}\n${result.stderr || ""}`,
    );
  }
  return (result.stdout || "") + (result.stderr || "");
}

function gitStatus() {
  return runCapture("git status --short", { cwd: root });
}

function parsePackFiles(packJson) {
  try {
    const trimmed = packJson.trim();
    const jsonStart = trimmed.indexOf("[\n  {");
    const jsonEnd = trimmed.lastIndexOf("]");
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart
      ? trimmed.slice(jsonStart, jsonEnd + 1)
      : trimmed.split("\n").filter(Boolean).at(-1) || "[]";
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed) && parsed[0]?.files) {
      return parsed[0].files.map((f) => f.path);
    }
    if (parsed?.files) return parsed.files.map((f) => f.path);
  } catch {
    // fall through to text parsing
  }
  return packJson
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function assertPackContents(files, dryRunOutput) {
  const required = [
    "package.json",
    "dist/index.js",
    "dist/cli/index.js",
    "dist/cli/session-runner.js",
    "dist/cli/meeting-runner.js",
    "bundled/web/wrangler.toml",
    "bundled/web/custom-worker.ts",
    "bundled/email-worker/index.js",
    "bundled/email-worker/wrangler.toml",
    "bundled/ws-do/index.js",
    "bundled/ws-do/wrangler.toml",
    "README.md",
    "LICENSE",
  ];

  for (const req of required) {
    const found =
      files.includes(req) ||
      files.some((file) => file === req || file.endsWith(`/${req}`)) ||
      dryRunOutput.includes(req);
    if (!found) {
      console.error(`Missing required pack entry: ${req}`);
      process.exit(1);
    }
  }

  if (!files.some((file) => file.startsWith("bundled/web/migrations/") && file.endsWith(".sql"))) {
    console.error("Pack must include bundled web D1 migration files");
    process.exit(1);
  }

  const bannedExact = [
    ".env",
    ".dev.vars",
    ".turbo",
  ];
  const bannedPrefixes = [
    "src/",
    "node_modules/",
    ".wrangler/state",
    "bundled/web/.wrangler/state",
    "bundled/web/.next/cache/",
    "bundled/web/.open-next/cache/",
    "bundled/email-worker/dist/",
    "bundled/ws-do/dist/",
  ];
  const bannedSuffixes = [".log", ".sqlite", ".sqlite3", ".db"];

  for (const file of files) {
    if (bannedExact.includes(file)) {
      console.error(`Pack must not include local file: ${file}`);
      process.exit(1);
    }
    if (bannedPrefixes.some((prefix) => file.startsWith(prefix))) {
      console.error(`Pack must not include banned path: ${file}`);
      process.exit(1);
    }
    if (bannedSuffixes.some((suffix) => file.endsWith(suffix))) {
      console.error(`Pack must not include generated/local state file: ${file}`);
      process.exit(1);
    }
  }
}

console.log("=== verify @phneakngar/app package ===");
console.log(`version: ${pkg.version}`);

if (!existsSync(join(appDir, "package.json"))) {
  console.error("App package not found at src/app");
  process.exit(1);
}

const beforeStatus = gitStatus();

run("pnpm build --filter=@phneakngar/shared --filter=@phneakngar/web --filter=@phneakngar/cli --filter=@phneakngar/email-worker --filter=@phneakngar/ws-do --filter=@phneakngar/app");
run("pnpm -C src/app run bundle");
run("pnpm -C src/app run build");

const afterBuildStatus = gitStatus();
if (afterBuildStatus !== beforeStatus) {
  const beforeLines = new Set(beforeStatus.split("\n").filter(Boolean));
  const afterLines = afterBuildStatus.split("\n").filter(Boolean);
  const newTrackedChanges = afterLines.filter((line) => !beforeLines.has(line) && !line.startsWith("?? "));
  if (newTrackedChanges.length > 0) {
    console.error("App package build changed tracked files:");
    console.error(newTrackedChanges.join("\n"));
    process.exit(1);
  }
}

const dryRun = runCapture("npm pack --dry-run --json", { cwd: appDir });
const files = parsePackFiles(dryRun);
assertPackContents(files, dryRun);

const packOut = runCapture("npm pack", { cwd: appDir });
const expectedName = `phneakngar-app-${pkg.version}.tgz`;
const discovered =
  readdirSync(appDir).find((file) => file === expectedName) ||
  readdirSync(appDir).find((file) => file.startsWith("phneakngar-app-") && file.endsWith(".tgz"));
if (!discovered) {
  console.error(`Tarball missing after npm pack. Output:\n${packOut}`);
  process.exit(1);
}

const finalTarballName = discovered;
const finalTarballPath = join(appDir, finalTarballName);
console.log(`Packed: ${finalTarballPath} (${statSync(finalTarballPath).size} bytes)`);

const cleanDir = mkdtempSync(join(tmpdir(), "phneakngar-app-verify-"));
const installDir = join(cleanDir, "app");
run(`mkdir -p "${installDir}"`);
run("npm init -y", { cwd: installDir });
run(`npm install "${finalTarballPath}"`, { cwd: installDir });

const binPath = join(installDir, "node_modules", ".bin", "phneakngar-app");
if (!existsSync(binPath)) {
  console.error(`Binary not linked at ${binPath}`);
  process.exit(1);
}

const smokeEnv = {
  PHNEAKNGAR_PROJECT_ROOT: join(cleanDir, "state"),
};
const versionOut = runCapture(`"${binPath}" --version`, { cwd: installDir, env: smokeEnv });
if (!versionOut.includes(pkg.version)) {
  console.error(`Unexpected version output:\n${versionOut}`);
  process.exit(1);
}
console.log(versionOut.trim());

const helpOut = runCapture(`"${binPath}" --help`, { cwd: installDir, env: smokeEnv });
for (const cmd of ["onboard", "start", "stop", "update", "cli"]) {
  if (!helpOut.includes(cmd)) {
    console.error(`Help missing command: ${cmd}`);
    process.exit(1);
  }
}

const passthroughVersionOut = runCapture(`"${binPath}" cli version`, { cwd: installDir, env: smokeEnv });
if (!passthroughVersionOut.includes(pkg.version) && !passthroughVersionOut.includes("phneakngar version")) {
  console.error(`Unexpected embedded CLI passthrough version output:\n${passthroughVersionOut}`);
  process.exit(1);
}

const embeddedCliPath = join(installDir, "node_modules", "@phneakngar", "app", "dist", "cli", "index.js");
if (!existsSync(embeddedCliPath)) {
  console.error(`Embedded CLI entry missing at ${embeddedCliPath}`);
  process.exit(1);
}
const cliHelpOut = runCapture(`node "${embeddedCliPath}" --help`, { cwd: installDir, env: smokeEnv });
for (const cmd of ["init", "doctor", "chhlat", "logs", "status"]) {
  if (!cliHelpOut.includes(cmd)) {
    console.error(`Embedded CLI help missing command: ${cmd}`);
    process.exit(1);
  }
}

try {
  rmSync(finalTarballPath, { force: true });
} catch {
  // ignore
}
try {
  rmSync(cleanDir, { recursive: true, force: true });
} catch {
  // ignore
}

console.log("\n=== PASS ===");
console.log(`@phneakngar/app@${pkg.version} pack install smoke OK`);
console.log("Client install (after publish): npx @phneakngar/app onboard");
console.log(`Local tarball install: npm install --global /path/to/${finalTarballName}`);
