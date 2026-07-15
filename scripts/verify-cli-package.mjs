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
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, resolve, win32 } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliDir = join(root, "src", "cli");
const require = createRequire(join(cliDir, "package.json"));
const pkg = require(join(cliDir, "package.json"));

export function expectedTarballName(version) {
  return `phneakngar-cli-${version}.tgz`;
}

export function findExpectedTarball(entries, version) {
  const expected = expectedTarballName(version);
  return entries.includes(expected) ? expected : undefined;
}

export function isExpectedVersionOutput(output, version) {
  return output.trim() === `phneakngar version ${version}`;
}

export function resolveGlobalBinPath(prefix, platform = process.platform) {
  return platform === "win32"
    ? win32.join(prefix, "phneakngar.cmd")
    : join(prefix, "bin", "phneakngar");
}

export function parsePackFiles(jsonOutput) {
  const parsed = JSON.parse(jsonOutput.trim());
  const details = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!details || !Array.isArray(details.files)) {
    throw new Error("npm pack JSON did not contain a files list");
  }
  return details.files.map((file) => file.path);
}

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

function runCaptureStdout(cmd, opts = {}) {
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
  return result.stdout || "";
}

export function main() {
  console.log("=== verify @phneakngar/cli package ===");
  console.log(`version: ${pkg.version}`);

  if (!existsSync(join(cliDir, "package.json"))) {
    console.error("CLI package not found at src/cli");
    process.exit(1);
  }

  // 1. Build
  run("pnpm run build", { cwd: cliDir });

  // 2. Dry-run pack listing. The explicit build above prepares all generated
  // files, so ignore lifecycle scripts here to keep npm's JSON output clean.
  const dryRunJson = runCaptureStdout(
    "npm pack --dry-run --json --ignore-scripts",
    { cwd: cliDir },
  );
  const files = parsePackFiles(dryRunJson);

  const required = ["package.json", "dist/index.js", "README.md", "LICENSE"];
  for (const req of required) {
    if (!files.includes(req)) {
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
  const expectedPath = join(cliDir, expectedTarballName(pkg.version));
  rmSync(expectedPath, { force: true });
  const packOut = runCapture("npm pack", { cwd: cliDir });
  const finalTarballName = findExpectedTarball(
    readdirSync(cliDir),
    pkg.version,
  );
  if (!finalTarballName) {
    console.error(
      `Expected ${expectedTarballName(pkg.version)} after npm pack. Output:\n${packOut}`,
    );
    process.exit(1);
  }
  const finalTarballPath = join(cliDir, finalTarballName);
  console.log(`Packed: ${finalTarballPath} (${statSync(finalTarballPath).size} bytes)`);

  // 4. Install globally under an isolated prefix, matching the documented
  // client installation without touching the developer's real global prefix.
  const cleanDir = mkdtempSync(join(tmpdir(), "phneakngar-cli-verify-"));
  const installPrefix = join(cleanDir, "global");
  mkdirSync(installPrefix, { recursive: true });
  run(
    `npm install --global --prefix "${installPrefix}" "${finalTarballPath}"`,
    { cwd: cleanDir },
  );

  const binPath = resolveGlobalBinPath(installPrefix);
  if (!existsSync(binPath)) {
    console.error(`Binary not linked at ${binPath}`);
    process.exit(1);
  }

  // 5. Smoke tests (no network required for version/help/doctor --skip-network)
  const versionOut = runCapture(`"${binPath}" version`, { cwd: cleanDir });
  if (!isExpectedVersionOutput(versionOut, pkg.version)) {
    console.error(
      `Expected exact version output "phneakngar version ${pkg.version}", received:\n${versionOut}`,
    );
    process.exit(1);
  }
  console.log(versionOut.trim());

  const helpOut = runCapture(`"${binPath}" --help`, { cwd: cleanDir });
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
    cwd: cleanDir,
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
    { cwd: cleanDir, env: doctorEnv },
  );
  if (!initOut.includes("example.com")) {
    console.error(`Unexpected init output:\n${initOut}`);
    process.exit(1);
  }

  // After init, doctor should still FAIL on registration/chhlat but config should PASS.
  const doctor2 = spawnSync(`"${binPath}" doctor --skip-network`, {
    cwd: cleanDir,
    shell: true,
    encoding: "utf-8",
    env: { ...process.env, ...doctorEnv },
  });
  const doctor2Out = (doctor2.stdout || "") + (doctor2.stderr || "");
  if (!doctor2Out.includes("[PASS] Config:")) {
    console.error(`Expected config PASS after init:\n${doctor2Out}`);
    process.exit(1);
  }

  // Cleanup tarball in package dir and isolated install prefix.
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
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
