import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { webBrainDoctorCheck } from "./web.js";

const originalProjectRoot = process.env.PHNEAKNGAR_PROJECT_ROOT;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "phneakngar-web-cmd-"));
  process.env.PHNEAKNGAR_PROJECT_ROOT = tempDir;
});

afterEach(() => {
  if (originalProjectRoot === undefined) delete process.env.PHNEAKNGAR_PROJECT_ROOT;
  else process.env.PHNEAKNGAR_PROJECT_ROOT = originalProjectRoot;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("webBrainDoctorCheck", () => {
  it("reports pass for lean toolkit", () => {
    const c = webBrainDoctorCheck();
    expect(c.name).toBe("Web brain");
    expect(c.status).toBe("pass");
    expect(c.detail.toLowerCase()).toMatch(/ready|lean/);
    expect(c.detail.toLowerCase()).not.toMatch(/wigolo dep/);
  });
});
