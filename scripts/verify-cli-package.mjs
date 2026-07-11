#!/usr/bin/env node
/**
 * Build, pack, install, and smoke-test @phneakngar/cli from a clean directory.
 * Does not publish. Safe to run on a developer machine.
 *
 * Usage (from monorepo root):
 *   node scripts/verify-cli-package.mjs
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
const cliDir = join(root, "src", "cli");
const require = createRequire(join(cliDir, "package.json"));
const pkg = require(join(cliDir, "package.json"));

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, {
    cwd: opts.cwd ?? root,
    stdio: "inherit",
    env: { ...process.env, ...opts.env },
  });
}

function runCapture(cmd, opts = {}) {
  const result = spawnSync(cmd, {
    cwd: opts.cwd ?? root,
    shell: true,
    encoding: "utf-8",
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): ${cmd}\n${result.stdout || ""}\n${result.stderr || ""}`,
    );
  }
  return (result.stdout || "") + (result.stderr || "");
}

console.log("=== verify @phneakngar/cli package ===");
console.log(`version: ${pkg.version}`);

if (!existsSync(join(cliDir, "package.json"))) {
  console.error("CLI package not found at src/cli");
  process.exit(1);
}

// 1. Build
run("pnpm run build", { cwd: cliDir });

// 2. Dry-run pack listing
const dryRun = runCapture("npm pack --dry-run --json", { cwd: cliDir });
let files = [];
try {
  const parsed = JSON.parse(dryRun.trim().split("\n").filter(Boolean).at(-1) || "[]");
  // npm pack --json may return array of pack details
  if (Array.isArray(parsed) && parsed[0]?.files) {
    files = parsed[0].files.map((f) => f.path);
  } else if (parsed?.files) {
    files = parsed.files.map((f) => f.path);
  }
} catch {
  // fallback: parse text listing
  files = dryRun
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("dist/") || l === "package.json" || l === "README.md" || l === "LICENSE");
}

const required = ["package.json", "dist/index.js", "README.md", "LICENSE"];
for (const req of required) {
  const found =
    files.includes(req) ||
    files.some((f) => f === req || f.endsWith(`/${req}`)) ||
    dryRun.includes(req);
  if (!found) {
    console.error(`Missing required pack entry: ${req}`);
    process.exit(1);
  }
}

const banned = ["src/", "commands/", "chhlat/", "node_modules/", ".phneakngar"];
for (const b of banned) {
  // allow dist only; fail if source trees are packed as top-level
  if (files.some((f) => f.startsWith(b))) {
    console.error(`Pack must not include source path: ${b}`);
    process.exit(1);
  }
}

// 3. Create real tarball
const packOut = runCapture("npm pack", { cwd: cliDir });
const expectedName = `phneakngar-cli-${pkg.version}.tgz`;
const discovered =
  readdirSync(cliDir).find((f) => f === expectedName) ||
  readdirSync(cliDir).find((f) => f.startsWith("phneakngar-cli-") && f.endsWith(".tgz"));
if (!discovered) {
  console.error(`Tarball missing after npm pack. Output:\n${packOut}`);
  process.exit(1);
}
const finalTarballName = discovered;
const finalTarballPath = join(cliDir, finalTarballName);
console.log(`Packed: ${finalTarballPath} (${statSync(finalTarballPath).size} bytes)`);

// 4. Install into clean project
const cleanDir = mkdtempSync(join(tmpdir(), "phneakngar-cli-verify-"));
const installDir = join(cleanDir, "app");
run(`mkdir -p "${installDir}"`);
run(`npm init -y`, { cwd: installDir });
run(`npm install "${finalTarballPath}"`, { cwd: installDir });

const binPath = join(installDir, "node_modules", ".bin", "phneakngar");
if (!existsSync(binPath)) {
  console.error(`Binary not linked at ${binPath}`);
  process.exit(1);
}

// 5. Smoke tests (no network required for version/help/doctor --skip-network)
const versionOut = runCapture(`"${binPath}" version`, { cwd: installDir });
if (!versionOut.includes(pkg.version) && !versionOut.includes("phneakngar version")) {
  console.error(`Unexpected version output:\n${versionOut}`);
  process.exit(1);
}
console.log(versionOut.trim());

const helpOut = runCapture(`"${binPath}" --help`, { cwd: installDir });
for (const cmd of ["init", "doctor", "chhlat", "logs", "status"]) {
  if (!helpOut.includes(cmd)) {
    console.error(`Help missing command: ${cmd}`);
    process.exit(1);
  }
}

const doctorEnv = {
  PHNEAKNGAR_PROJECT_ROOT: join(cleanDir, "state"),
};
// doctor exits 1 when not registered — still a successful smoke if it runs.
const doctorResult = spawnSync(`"${binPath}" doctor --skip-network`, {
  cwd: installDir,
  shell: true,
  encoding: "utf-8",
  env: { ...process.env, ...doctorEnv },
});
const doctorOut = (doctorResult.stdout || "") + (doctorResult.stderr || "");
if (!doctorOut.includes("phneakngar doctor") || !doctorOut.includes("Node.js")) {
  console.error(`Unexpected doctor output (code ${doctorResult.status}):\n${doctorOut}`);
  process.exit(1);
}
console.log(doctorOut.trim());

const initOut = runCapture(
  `"${binPath}" init --server https://example.com`,
  { cwd: installDir, env: doctorEnv },
);
if (!initOut.includes("example.com")) {
  console.error(`Unexpected init output:\n${initOut}`);
  process.exit(1);
}

// After init, doctor should still FAIL on registration/chhlat but config should PASS.
const doctor2 = spawnSync(`"${binPath}" doctor --skip-network`, {
  cwd: installDir,
  shell: true,
  encoding: "utf-8",
  env: { ...process.env, ...doctorEnv },
});
const doctor2Out = (doctor2.stdout || "") + (doctor2.stderr || "");
if (!doctor2Out.includes("[PASS] Config:")) {
  console.error(`Expected config PASS after init:\n${doctor2Out}`);
  process.exit(1);
}

// Cleanup tarball in package dir (keep cleanDir removal)
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

// List remaining dist for operator confidence
const distFiles = readdirSync(join(cliDir, "dist"));
console.log("\n=== PASS ===");
console.log(`@phneakngar/cli@${pkg.version} pack install smoke OK`);
console.log(`dist/: ${distFiles.join(", ")}`);
console.log("Client install (after publish): npm install --global @phneakngar/cli");
console.log(`Local tarball install: npm install --global /path/to/${finalTarballName}`);
