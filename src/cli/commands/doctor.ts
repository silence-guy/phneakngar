import { Command } from "commander";
import { existsSync, accessSync, constants } from "fs";
import { loadCLIConfigForProfile, configPath, configDir } from "../lib/config.js";
import { getServerUrl, cmdPrefix } from "../lib/env.js";
import { detectRuntimes } from "../lib/runtimes.js";
import { getCurrentVersion } from "../lib/version.js";
import { isProcessAlive, readChhlatPid } from "../chhlat/pidfile.js";
import { chhlatLogFilePath, pidFilePath } from "../chhlat/config.js";

export type CheckStatus = "pass" | "fail" | "warn" | "info";

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  ok: boolean;
  exitCode: number;
}

const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 19;

function nodeVersionParts(version = process.versions.node): {
  major: number;
  minor: number;
  patch: number;
} {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((p) => Number(p) || 0);
  return { major, minor, patch };
}

export function checkNodeVersion(version = process.versions.node): DoctorCheck {
  const { major, minor } = nodeVersionParts(version);
  const ok = major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR);
  return {
    name: "Node.js",
    status: ok ? "pass" : "fail",
    detail: `v${version}`,
    hint: ok
      ? undefined
      : `Install Node.js >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 (https://nodejs.org/)`,
  };
}

export function checkCliVersion(): DoctorCheck {
  return {
    name: "CLI version",
    status: "info",
    detail: getCurrentVersion(),
  };
}

export function checkConfig(profile?: string): DoctorCheck {
  const path = configPath();
  const dir = configDir();
  if (!existsSync(path)) {
    return {
      name: "Config",
      status: "warn",
      detail: `not found at ${path}`,
      hint: `Run '${cmdPrefix()} init' then '${cmdPrefix()} login' or '${cmdPrefix()} register --token <token>'`,
    };
  }
  try {
    accessSync(dir, constants.R_OK | constants.W_OK);
  } catch {
    return {
      name: "Config",
      status: "fail",
      detail: `cannot read/write ${dir}`,
      hint: `Fix permissions on ${dir} (recommended: chmod 700)`,
    };
  }
  const cfg = loadCLIConfigForProfile(profile);
  return {
    name: "Config",
    status: "pass",
    detail: `${path} (server=${cfg.server_url || getServerUrl()})`,
  };
}

export function checkRegistration(profile?: string): DoctorCheck {
  const cfg = loadCLIConfigForProfile(profile);
  const ws = cfg.watched_workspaces?.find((w) => w.token && w.status !== "deleted");
  if (!ws?.token) {
    return {
      name: "Registration",
      status: "fail",
      detail: "not registered",
      hint: `Run '${cmdPrefix()} login' or '${cmdPrefix()} register --token al_...'`,
    };
  }
  return {
    name: "Registration",
    status: "pass",
    detail: `workspace ${ws.name || "unknown"} (${ws.id || "no-id"})`,
  };
}

export function checkRuntimes(): DoctorCheck {
  const runtimes = detectRuntimes();
  if (runtimes.length === 0) {
    return {
      name: "AI runtimes",
      status: "fail",
      detail: "none found on PATH",
      hint: "Install at least one of: claude, codex, opencode, grok — then re-run doctor",
    };
  }
  return {
    name: "AI runtimes",
    status: "pass",
    detail: runtimes.map((r) => (r.version ? `${r.type} (${r.version})` : r.type)).join(", "),
  };
}

export function checkChhlat(profile?: string): DoctorCheck {
  const pid = readChhlatPid(profile);
  if (pid == null) {
    return {
      name: "Chhlat",
      status: "fail",
      detail: "not running",
      hint: `Start with '${cmdPrefix()} chhlat start'`,
    };
  }
  if (!isProcessAlive(pid)) {
    return {
      name: "Chhlat",
      status: "fail",
      detail: `stale pidfile (pid=${pid}) at ${pidFilePath(profile)}`,
      hint: `Remove stale pidfile or run '${cmdPrefix()} chhlat stop' then '${cmdPrefix()} chhlat start'`,
    };
  }
  return {
    name: "Chhlat",
    status: "pass",
    detail: `running (pid=${pid})`,
  };
}

export async function checkChhlatHealth(
  profile?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DoctorCheck> {
  const pid = readChhlatPid(profile);
  if (pid == null || !isProcessAlive(pid)) {
    return {
      name: "Chhlat health",
      status: "warn",
      detail: "skipped (chhlat not running)",
    };
  }
  const port = Number(process.env.PHNEAKNGAR_HEALTH_PORT) || 19514;
  const url = `http://127.0.0.1:${port}/health`;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return {
        name: "Chhlat health",
        status: "warn",
        detail: `HTTP ${res.status} from ${url}`,
        hint: `Check logs: ${chhlatLogFilePath()}`,
      };
    }
    let body = "";
    try {
      body = await res.text();
    } catch {
      // optional
    }
    return {
      name: "Chhlat health",
      status: "pass",
      detail: body ? `ok (${url})` : `ok HTTP ${res.status} (${url})`,
    };
  } catch (err) {
    return {
      name: "Chhlat health",
      status: "warn",
      detail: `unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`,
      hint: `Check logs: ${chhlatLogFilePath()}`,
    };
  }
}

export async function checkServerReachability(
  profile?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DoctorCheck> {
  const cfg = loadCLIConfigForProfile(profile);
  const serverUrl = (cfg.server_url || getServerUrl()).replace(/\/$/, "");
  const healthUrl = `${serverUrl}/api/health`;
  try {
    const res = await fetchImpl(healthUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return {
        name: "Server",
        status: "warn",
        detail: `HTTP ${res.status} from ${healthUrl}`,
        hint: "Confirm PHNEAKNGAR_SERVER_URL / config server_url and that the control plane is up",
      };
    }
    return {
      name: "Server",
      status: "pass",
      detail: `reachable (${healthUrl})`,
    };
  } catch (err) {
    return {
      name: "Server",
      status: "warn",
      detail: `unreachable: ${err instanceof Error ? err.message : String(err)}`,
      hint: `Set server with '${cmdPrefix()} init --server <url>' or '${cmdPrefix()} config set-server <url>'`,
    };
  }
}

export async function runDoctor(
  profile?: string,
  options: { fetchImpl?: typeof fetch; skipNetwork?: boolean } = {},
): Promise<DoctorResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const checks: DoctorCheck[] = [
    checkNodeVersion(),
    checkCliVersion(),
    checkConfig(profile),
    checkRegistration(profile),
    checkRuntimes(),
    checkChhlat(profile),
  ];

  if (!options.skipNetwork) {
    checks.push(await checkChhlatHealth(profile, fetchImpl));
    checks.push(await checkServerReachability(profile, fetchImpl));
  }

  const hasFail = checks.some((c) => c.status === "fail");
  return {
    checks,
    ok: !hasFail,
    exitCode: hasFail ? 1 : 0,
  };
}

function formatStatus(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "PASS";
    case "fail":
      return "FAIL";
    case "warn":
      return "WARN";
    case "info":
      return "INFO";
  }
}

export function printDoctorResult(result: DoctorResult): void {
  console.log("\nphneakngar doctor\n");
  for (const check of result.checks) {
    const label = formatStatus(check.status).padEnd(4);
    console.log(`  [${label}] ${check.name}: ${check.detail}`);
    if (check.hint) {
      console.log(`         → ${check.hint}`);
    }
  }
  console.log("");
  if (result.ok) {
    console.log("Result: ready (no hard failures).");
  } else {
    console.log("Result: not ready — fix FAIL items above, then re-run doctor.");
  }
  console.log("");
}

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Diagnose local agent install and runtime readiness")
    .option("--skip-network", "Skip server and health HTTP checks")
    .action(async (opts, command) => {
      const profile: string | undefined = command.parent?.opts().profile;
      const result = await runDoctor(profile, { skipNetwork: !!opts.skipNetwork });
      printDoctorResult(result);
      process.exitCode = result.exitCode;
    });
}
