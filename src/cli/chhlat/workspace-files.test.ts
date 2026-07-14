import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join, relative } from "path";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, symlinkSync, realpathSync } from "fs";
import { tmpdir } from "os";
import { readDirectoryTree, readFileContent, validatePath } from "./workspace-files";

let workDir: string;
let outsideDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "phneakngar-test-files-"));
  outsideDir = mkdtempSync(join(tmpdir(), "phneakngar-test-outside-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
});

describe("validatePath", () => {
  it("returns the canonical path for a valid nested file", async () => {
    mkdirSync(join(workDir, "experiences"));
    writeFileSync(join(workDir, "experiences", "workflow.md"), "safe");

    const result = await validatePath(workDir, "experiences/workflow.md");

    expect(result).toBe(realpathSync(join(workDir, "experiences", "workflow.md")));
  });

  it("returns null for path traversal attempt", async () => {
    writeFileSync(join(outsideDir, "secret.md"), "secret");
    expect(await validatePath(workDir, relative(workDir, join(outsideDir, "secret.md")))).toBeNull();
  });

  it("returns null for absolute path outside workdir", async () => {
    writeFileSync(join(outsideDir, "secret.md"), "secret");
    expect(await validatePath(workDir, join(outsideDir, "secret.md"))).toBeNull();
  });

  it("rejects a file symlink whose target escapes the workdir", async () => {
    const outsideFile = join(outsideDir, "secret.md");
    writeFileSync(outsideFile, "secret");
    symlinkSync(outsideFile, join(workDir, "secret-link.md"), "file");

    expect(await validatePath(workDir, "secret-link.md")).toBeNull();
  });

  it("rejects a directory symlink whose target escapes the workdir", async () => {
    writeFileSync(join(outsideDir, "secret.md"), "secret");
    symlinkSync(outsideDir, join(workDir, "outside-link"), process.platform === "win32" ? "junction" : "dir");

    expect(await validatePath(workDir, "outside-link")).toBeNull();
  });

  it("allows a symlink whose canonical target remains in the workdir", async () => {
    writeFileSync(join(workDir, "AGENTS.md"), "safe");
    symlinkSync(join(workDir, "AGENTS.md"), join(workDir, "CLAUDE.md"), "file");

    expect(await validatePath(workDir, "CLAUDE.md")).toBe(realpathSync(join(workDir, "AGENTS.md")));
  });

  it("returns the canonical workdir for '.'", async () => {
    expect(await validatePath(workDir, ".")).toBe(realpathSync(workDir));
  });
});

describe("readDirectoryTree", () => {
  it("lists files and directories sorted correctly", async () => {
    mkdirSync(join(workDir, "experiences"));
    writeFileSync(join(workDir, "memory.md"), "# Memory");
    writeFileSync(join(workDir, "CLAUDE.md"), "# Instructions");

    const entries = await readDirectoryTree(workDir, workDir);

    expect(entries.length).toBe(3);
    expect(entries[0].name).toBe("experiences");
    expect(entries[0].isDirectory).toBe(true);
    expect(entries[1].name).toBe("CLAUDE.md");
    expect(entries[1].isDirectory).toBe(false);
    expect(entries[2].name).toBe("memory.md");
  });

  it("skips all dotfiles and dotdirs", async () => {
    mkdirSync(join(workDir, ".git"));
    mkdirSync(join(workDir, ".context_timeline"));
    writeFileSync(join(workDir, ".hidden"), "secret");
    writeFileSync(join(workDir, "visible.md"), "hello");

    const entries = await readDirectoryTree(workDir, workDir);
    const names = entries.map((e) => e.name);

    expect(names).toContain("visible.md");
    expect(names).not.toContain(".context_timeline");
    expect(names).not.toContain(".git");
    expect(names).not.toContain(".hidden");
  });

  it("skips node_modules", async () => {
    mkdirSync(join(workDir, "node_modules"));
    writeFileSync(join(workDir, "index.js"), "// ok");

    const entries = await readDirectoryTree(workDir, workDir);
    const names = entries.map((e) => e.name);

    expect(names).not.toContain("node_modules");
    expect(names).toContain("index.js");
  });

  it("returns empty array for non-existent directory", async () => {
    const entries = await readDirectoryTree(join(workDir, "nope"), workDir);
    expect(entries).toEqual([]);
  });

  it("returns relative paths from basePath", async () => {
    mkdirSync(join(workDir, "sub"));
    writeFileSync(join(workDir, "sub", "file.txt"), "hi");

    const entries = await readDirectoryTree(join(workDir, "sub"), workDir);

    expect(entries[0].path).toBe(join("sub", "file.txt"));
  });

  it("includes size and modifiedAt for files", async () => {
    writeFileSync(join(workDir, "data.json"), '{"key":"value"}');

    const entries = await readDirectoryTree(workDir, workDir);
    const file = entries.find((e) => e.name === "data.json")!;

    expect(file.size).toBeGreaterThan(0);
    expect(file.modifiedAt).toBeTruthy();
    expect(new Date(file.modifiedAt).getTime()).toBeGreaterThan(0);
  });

  it("omits file and directory symlinks that escape the workdir", async () => {
    const outsideFile = join(outsideDir, "secret.md");
    writeFileSync(outsideFile, "secret");
    symlinkSync(outsideFile, join(workDir, "secret-link.md"), "file");
    symlinkSync(outsideDir, join(workDir, "outside-link"), process.platform === "win32" ? "junction" : "dir");

    const entries = await readDirectoryTree(workDir, workDir);

    expect(entries.map((entry) => entry.name)).not.toContain("secret-link.md");
    expect(entries.map((entry) => entry.name)).not.toContain("outside-link");
  });

  it("includes safe in-workdir symlinks using their logical path", async () => {
    writeFileSync(join(workDir, "AGENTS.md"), "safe");
    symlinkSync(join(workDir, "AGENTS.md"), join(workDir, "CLAUDE.md"), "file");

    const entries = await readDirectoryTree(workDir, workDir);
    const link = entries.find((entry) => entry.name === "CLAUDE.md");

    expect(link).toMatchObject({ path: "CLAUDE.md", isDirectory: false, size: 4 });
  });
});

describe("readFileContent", () => {
  it("reads text file content", async () => {
    writeFileSync(join(workDir, "readme.md"), "# Hello World");

    const result = await readFileContent(join(workDir, "readme.md"));

    expect(result.content).toBe("# Hello World");
    expect(result.isBinary).toBe(false);
  });

  it("marks unknown extensions as binary", async () => {
    writeFileSync(join(workDir, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await readFileContent(join(workDir, "image.png"));

    expect(result.content).toBeNull();
    expect(result.isBinary).toBe(true);
  });

  it("reads files with known extensions", async () => {
    for (const ext of [".json", ".ts", ".py", ".yaml", ".sh"]) {
      writeFileSync(join(workDir, `test${ext}`), "content");
      const result = await readFileContent(join(workDir, `test${ext}`));
      expect(result.isBinary).toBe(false);
      expect(result.content).toBe("content");
    }
  });

  it("throws for directories", async () => {
    mkdirSync(join(workDir, "subdir"));
    await expect(readFileContent(join(workDir, "subdir"))).rejects.toThrow("Cannot read a directory");
  });

  it("throws for files over 1MB", async () => {
    writeFileSync(join(workDir, "big.txt"), "x".repeat(1_048_577));
    await expect(readFileContent(join(workDir, "big.txt"))).rejects.toThrow("File too large");
  });

  it("reads extensionless files as text", async () => {
    writeFileSync(join(workDir, "Makefile"), "all: build");
    const result = await readFileContent(join(workDir, "Makefile"));
    expect(result.isBinary).toBe(false);
    expect(result.content).toBe("all: build");
  });
});
