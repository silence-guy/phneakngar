import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  checkFilesystemAccess,
  ensureFilesystemAccess,
  fsAccessStartupNotes,
  isOpenablePlatform,
  defaultProbe,
  type ProbeResult,
} from "./fs-access.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "phneakngar-fs-access-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function probeMap(map: Record<string, ProbeResult>): (dir: string) => ProbeResult {
  return (dir) => map[dir] ?? "ok";
}

function errno(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code });
}

describe("isOpenablePlatform", () => {
  it("only macOS can auto-open a privacy settings pane", () => {
    expect(isOpenablePlatform("darwin")).toBe(true);
    expect(isOpenablePlatform("linux")).toBe(false);
    expect(isOpenablePlatform("win32")).toBe(false);
    expect(isOpenablePlatform("other")).toBe(false);
  });
});

describe("checkFilesystemAccess", () => {
  it("darwin probes Downloads/Desktop/Documents in order and surfaces the FDA uri when blocked", async () => {
    const home = "/Users/tester";
    const downloads = join(home, "Downloads");
    const result = await checkFilesystemAccess({
      platform: "darwin",
      homedir: () => home,
      probe: probeMap({ [downloads]: "blocked" }),
    });
    expect(result.platform).toBe("darwin");
    expect(result.ok).toBe(false);
    expect(result.checked).toEqual([
      join(home, "Downloads"),
      join(home, "Desktop"),
      join(home, "Documents"),
    ]);
    expect(result.blocked).toEqual([downloads]);
    expect(result.settingsUri).toContain("Privacy_AllFiles");
    expect(result.hint).toMatch(/Full Disk Access/);
  });

  it("darwin with everything readable reports ok and no hint", async () => {
    const result = await checkFilesystemAccess({
      platform: "darwin",
      homedir: () => "/Users/tester",
      probe: () => "ok",
    });
    expect(result.ok).toBe(true);
    expect(result.blocked).toEqual([]);
    expect(result.hint).toBe("");
  });

  it("missing directories are not treated as blocked", async () => {
    const result = await checkFilesystemAccess({
      platform: "darwin",
      homedir: () => "/Users/tester",
      probe: () => "missing",
    });
    expect(result.ok).toBe(true);
    expect(result.blocked).toEqual([]);
  });

  it("linux probes the home dir in order with a sandbox hint and no settings uri", async () => {
    const home = "/home/tester";
    const result = await checkFilesystemAccess({
      platform: "linux",
      homedir: () => home,
      probe: probeMap({ [home]: "blocked" }),
    });
    expect(result.ok).toBe(false);
    expect(result.checked).toEqual([home]);
    expect(result.blocked).toEqual([home]);
    expect(result.settingsUri).toBeUndefined();
    expect(result.hint).toMatch(/Snap|Flatpak|AppArmor|container/);
  });

  it("win32 probes the user folders in order with a Controlled-folder-access hint and no settings uri", async () => {
    const home = "C:\\Users\\tester";
    const result = await checkFilesystemAccess({
      platform: "win32",
      homedir: () => home,
      probe: probeMap({ [join(home, "Documents")]: "blocked" }),
    });
    expect(result.ok).toBe(false);
    expect(result.checked).toEqual([
      join(home, "Documents"),
      join(home, "Desktop"),
      join(home, "Downloads"),
    ]);
    expect(result.settingsUri).toBeUndefined();
    expect(result.hint).toMatch(/Controlled folder access|logged-in user|SYSTEM/);
  });
});

describe("ensureFilesystemAccess", () => {
  const home = "/Users/tester";
  const blockedDarwin = () => ({
    platform: "darwin" as const,
    homedir: () => home,
    probe: probeMap({ [join(home, "Downloads")]: "blocked" }),
  });

  it("opens the macOS pane once and throttles the next call inside the window", async () => {
    const opens: string[] = [];
    const base = { ...blockedDarwin(), markerPath: join(tmp, "marker"), now: () => 1_000_000 };

    const first = await ensureFilesystemAccess({ ...base, open: (t) => opens.push(t) });
    expect(first.opened).toBe(true);
    expect(first.throttled).toBe(false);
    expect(opens).toHaveLength(1);
    expect(opens[0]).toContain("Privacy_AllFiles");

    const second = await ensureFilesystemAccess({ ...base, open: (t) => opens.push(t) });
    expect(second.opened).toBe(false);
    expect(second.throttled).toBe(true);
    expect(opens).toHaveLength(1);

    const forced = await ensureFilesystemAccess({
      ...base,
      open: (t) => opens.push(t),
      ignoreThrottle: true,
    });
    expect(forced.opened).toBe(true);
    expect(opens).toHaveLength(2);
  });

  it("re-opens once the throttle window has elapsed", async () => {
    const opens: string[] = [];
    let t = 1000;
    const base = {
      ...blockedDarwin(),
      markerPath: join(tmp, "marker-expiry"),
      now: () => t,
      throttleMs: 100,
    };

    await ensureFilesystemAccess({ ...base, open: (t2) => opens.push(t2) });
    expect(opens).toHaveLength(1);

    t = 1050;
    const throttled = await ensureFilesystemAccess({ ...base, open: (t2) => opens.push(t2) });
    expect(throttled.throttled).toBe(true);
    expect(opens).toHaveLength(1);

    t = 1201;
    const reopened = await ensureFilesystemAccess({ ...base, open: (t2) => opens.push(t2) });
    expect(reopened.opened).toBe(true);
    expect(opens).toHaveLength(2);
  });

  it("persists the prompt timestamp into the marker file", async () => {
    const markerPath = join(tmp, "marker-content");
    await ensureFilesystemAccess({
      ...blockedDarwin(),
      markerPath,
      now: () => 424242,
      open: () => {},
    });
    expect(readFileSync(markerPath, "utf8").trim()).toBe("424242");
  });

  it("does not open when autoOpen is false even if blocked on darwin", async () => {
    const opens: string[] = [];
    const r = await ensureFilesystemAccess({
      ...blockedDarwin(),
      markerPath: join(tmp, "marker-autooff"),
      autoOpen: false,
      open: (t) => opens.push(t),
    });
    expect(r.ok).toBe(false);
    expect(r.opened).toBe(false);
    expect(r.throttled).toBe(false);
    expect(opens).toEqual([]);
  });

  it("does not open on linux even when blocked (not an openable platform)", async () => {
    const home2 = "/home/tester";
    const opens: string[] = [];
    const r = await ensureFilesystemAccess({
      platform: "linux",
      homedir: () => home2,
      probe: probeMap({ [home2]: "blocked" }),
      markerPath: join(tmp, "marker-linux"),
      open: (t) => opens.push(t),
    });
    expect(r.ok).toBe(false);
    expect(r.opened).toBe(false);
    expect(opens).toEqual([]);
  });

  it("does nothing when access is already ok", async () => {
    const opens: string[] = [];
    const r = await ensureFilesystemAccess({
      platform: "darwin",
      homedir: () => "/Users/tester",
      probe: () => "ok",
      markerPath: join(tmp, "marker-ok"),
      open: (t) => opens.push(t),
    });
    expect(r.ok).toBe(true);
    expect(r.opened).toBe(false);
    expect(opens).toEqual([]);
  });
});

describe("defaultProbe", () => {
  it("returns ok for an existing dir and missing for a nonexistent one", async () => {
    mkdirSync(join(tmp, "real"), { recursive: true });
    expect(await defaultProbe(join(tmp, "real"))).toBe("ok");
    expect(await defaultProbe(join(tmp, "does-not-exist"))).toBe("missing");
  });

  it("maps EPERM/EACCES to blocked (fail-closed) and ENOENT to missing", async () => {
    expect(await defaultProbe("/x", { read: async () => { throw errno("EPERM"); } })).toBe("blocked");
    expect(await defaultProbe("/x", { read: async () => { throw errno("EACCES"); } })).toBe("blocked");
    expect(await defaultProbe("/x", { read: async () => { throw errno("ENOENT"); } })).toBe("missing");
  });

  it("reports blocked on a hung read instead of hanging forever (timeout safeguard)", async () => {
    const start = Date.now();
    const r = await defaultProbe("/x", {
      timeoutMs: 20,
      read: () => new Promise<never>(() => {}),
    });
    expect(r).toBe("blocked");
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe("fsAccessStartupNotes", () => {
  const base = {
    platform: "darwin" as const,
    checked: ["/Users/a/Downloads"],
    blocked: ["/Users/a/Downloads"],
    settingsUri: "x-apple:foo",
    hint: "HINT",
  };

  it("emits nothing when access is ok", () => {
    expect(fsAccessStartupNotes({ ...base, ok: true, opened: false, throttled: false })).toEqual({
      info: [],
    });
  });

  it("warns and adds the opened info line when the pane was opened", () => {
    const notes = fsAccessStartupNotes({ ...base, ok: false, opened: true, throttled: false });
    expect(notes.warn).toContain("Filesystem access restricted");
    expect(notes.warn).toContain("HINT");
    expect(notes.info).toEqual([
      "Opened the OS privacy settings pane — grant access there, then restart chhlat.",
    ]);
  });

  it("warns and adds the throttled info line (with the grant-access command) when throttled", () => {
    const notes = fsAccessStartupNotes({ ...base, ok: false, opened: false, throttled: true });
    expect(notes.warn).toBeTruthy();
    expect(notes.info[0]).toContain("grant-access");
    expect(notes.info[0]).toContain("throttled");
  });

  it("warns only (no info) when blocked but neither opened nor throttled", () => {
    const notes = fsAccessStartupNotes({ ...base, ok: false, opened: false, throttled: false });
    expect(notes.warn).toBeTruthy();
    expect(notes.info).toEqual([]);
  });
});
