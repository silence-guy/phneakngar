import { describe, it, expect, vi } from "vitest";
import { runGrantAccess } from "./grant-access.js";
import type { FsAccessResult } from "../chhlat/fs-access.js";

function result(over: Partial<FsAccessResult> = {}): FsAccessResult {
  return { platform: "darwin", ok: true, checked: [], blocked: [], hint: "", ...over };
}

describe("runGrantAccess", () => {
  it("does not open and reports full access when ok", async () => {
    const open = vi.fn();
    const { report, opened } = await runGrantAccess({
      check: async () => result({ checked: ["/Users/a/Downloads"] }),
      open,
    });
    expect(open).not.toHaveBeenCalled();
    expect(opened).toBe(false);
    expect(report).toContain("full read access");
    expect(report).toContain("[ok     ] /Users/a/Downloads");
  });

  it("opens the settings pane exactly once when blocked on darwin", async () => {
    const open = vi.fn();
    const uri = "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";
    const { report, opened } = await runGrantAccess({
      check: async () =>
        result({
          ok: false,
          checked: ["/Users/a/Downloads"],
          blocked: ["/Users/a/Downloads"],
          settingsUri: uri,
          hint: "macOS privacy (TCC) blocks reading /Users/a/Downloads.",
        }),
      open,
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(uri);
    expect(opened).toBe(true);
    expect(report).toContain("[BLOCKED] /Users/a/Downloads");
    expect(report).toContain("Opened the OS privacy settings pane");
    expect(report).toContain("macOS privacy (TCC)");
  });

  it("does not open on linux (no settings uri) and surfaces the hint", async () => {
    const open = vi.fn();
    const { report, opened } = await runGrantAccess({
      check: async () =>
        result({
          platform: "linux",
          ok: false,
          checked: ["/home/a"],
          blocked: ["/home/a"],
          hint: "Could not read /home/a. On Linux your own files are readable by default",
        }),
      open,
    });
    expect(open).not.toHaveBeenCalled();
    expect(opened).toBe(false);
    expect(report).toContain("Could not read /home/a. On Linux");
    expect(report).not.toContain("Opened the OS privacy settings pane");
    expect(report).not.toContain("Could not auto-open");
  });
});
