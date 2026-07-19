#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const WORKSPACE_DIRS = [
  "src/shared",
  "src/cli",
  "src/web-brain",
  "src/app",
  "src/web",
  "src/email-worker",
  "src/ws-do",
  "src/desktop",
];

function readPkg(dir) {
  const p = join(ROOT, dir, "package.json");
  return { path: p, pkg: JSON.parse(readFileSync(p, "utf8")) };
}

function writePkg(path, pkg) {
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
}

function bumpSemver(current, type) {
  const base = current.split("-")[0];
  const [major, minor, patch] = base.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const args = process.argv.slice(2);
const updateMinCli = args.includes("--min-cli");
const includeDesktop = args.includes("--desktop");
const includeMobile = args.includes("--mobile");
const dryRun = args.includes("--dry-run");
const filtered = args.filter((a) => !a.startsWith("--"));
const arg = filtered[0];

if (!arg) {
  console.error("Usage: pnpm bump <version|patch|minor|major> [flags]");
  console.error("  pnpm bump patch");
  console.error("  pnpm bump patch --desktop        # trigger desktop build");
  console.error("  pnpm bump patch --mobile         # trigger mobile build");
  console.error("  pnpm bump patch --desktop --mobile  # trigger both");
  console.error("  pnpm bump patch --min-cli        # also update MIN_CLI_VERSION");
  console.error("  pnpm bump patch --dry-run        # validate changes without writing or committing");
  process.exit(1);
}

const BUMP_TYPES = ["patch", "minor", "major"];
let version;

if (BUMP_TYPES.includes(arg)) {
  const { pkg } = readPkg(WORKSPACE_DIRS[0]);
  version = bumpSemver(pkg.version, arg);
} else {
  version = arg.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    console.error(`Invalid version: ${arg}`);
    process.exit(1);
  }
}

console.log(`\n📦 ${dryRun ? "Validating" : "Bumping"} all packages at v${version}${dryRun ? " (dry run)" : ""}\n`);

const files = [];

for (const dir of WORKSPACE_DIRS) {
  const { path, pkg } = readPkg(dir);
  const old = pkg.version;
  pkg.version = version;
  if (!dryRun) {
    writePkg(path, pkg);
    files.push(path);
  }
  console.log(`  ${pkg.name}: ${old} → ${version}`);
}

// Sync tauri.conf.json version (always)
const tauriConfPath = join(ROOT, "src/desktop/src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
const oldTauriVersion = tauriConf.version;
tauriConf.version = version;
if (!dryRun) {
  writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
  files.push(tauriConfPath);
}
console.log(`  tauri.conf.json: ${oldTauriVersion} → ${version}`);

// Sync Cargo.toml version (always)
const cargoTomlPath = join(ROOT, "src/desktop/src-tauri/Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf8");
const oldCargoMatch = cargoToml.match(/^version = "([^"]+)"/m);
const oldCargoVersion = oldCargoMatch ? oldCargoMatch[1] : "unknown";
cargoToml = cargoToml.replace(/^version = "[^"]+"/m, `version = "${version}"`);
if (!dryRun) {
  writeFileSync(cargoTomlPath, cargoToml);
  files.push(cargoTomlPath);
}
console.log(`  Cargo.toml: ${oldCargoVersion} → ${version}`);

// Sync Cargo.lock version for phneakngar-desktop (always)
const cargoLockPath = join(ROOT, "src/desktop/src-tauri/Cargo.lock");
let cargoLock = readFileSync(cargoLockPath, "utf8");
cargoLock = cargoLock.replace(
  /(name = "phneakngar-desktop"\nversion = ")[^"]+"/,
  `$1${version}"`,
);
if (!dryRun) {
  writeFileSync(cargoLockPath, cargoLock);
  files.push(cargoLockPath);
}
console.log(`  Cargo.lock: phneakngar-desktop → ${version}`);

// Desktop deploy trigger (only with --desktop)
if (includeDesktop) {
  const triggerPath = join(ROOT, "src/desktop/.deploy-version");
  if (!dryRun) {
    writeFileSync(triggerPath, version + "\n");
    files.push(triggerPath);
  }
  console.log(`  Desktop deploy trigger written`);
}

// Mobile deploy trigger (only with --mobile)
if (includeMobile) {
  const triggerPath = join(ROOT, "src/desktop/.deploy-version-mobile");
  if (!dryRun) {
    writeFileSync(triggerPath, version + "\n");
    files.push(triggerPath);
  }
  console.log(`  Mobile deploy trigger written`);
}

if (updateMinCli) {
  const tomlPath = join(ROOT, "src/web/wrangler.toml");
  let toml = readFileSync(tomlPath, "utf8");
  const oldMatch = toml.match(/MIN_CLI_VERSION\s*=\s*"([^"]+)"/);
  const oldMinCli = oldMatch ? oldMatch[1] : "unknown";
  toml = toml.replace(/MIN_CLI_VERSION\s*=\s*"[^"]+"/, `MIN_CLI_VERSION = "${version}"`);
  if (!dryRun) {
    writeFileSync(tomlPath, toml);
    files.push(tomlPath);
  }
  console.log(`  MIN_CLI_VERSION: ${oldMinCli} → ${version} (wrangler.toml)`);
}

if (dryRun) {
  console.log(`\n✅ Dry run passed. No files were written, staged, or committed.`);
  process.exit(0);
}

const gitFiles = files.map((f) => f.replace(ROOT + "/", ""));
execSync(`git add ${gitFiles.join(" ")}`, { cwd: ROOT, stdio: "inherit" });
execSync(`git commit -m "release: v${version}"`, { cwd: ROOT, stdio: "inherit" });

console.log(`\n✅ Committed: v${version}`);
console.log(`\n👉 Next steps:`);
console.log(`   git push origin main`);
console.log(`   # CI will auto-tag and publish configured release artifacts.`);
console.log(`   # Cloudflare deployment remains a separate manual operator action.`);
if (includeDesktop) console.log(`   #   - Desktop build (macOS/Linux/Windows)`);
if (includeMobile) console.log(`   #   - Mobile build (iOS/Android)`);
if (!includeDesktop && !includeMobile) console.log(`   #   - No desktop/mobile builds (add --desktop or --mobile to include)`);
console.log();
