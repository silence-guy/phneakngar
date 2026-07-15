import { describe, expect, it } from "vitest";
import { join, win32 } from "node:path";
import {
  expectedTarballName,
  findExpectedTarball,
  isExpectedVersionOutput,
  parsePackFiles,
  resolveGlobalBinPath,
} from "../../../scripts/verify-cli-package.mjs";

describe("CLI package verifier helpers", () => {
  it("selects only the tarball matching the current package version", () => {
    const entries = [
      "phneakngar-cli-0.0.149.tgz",
      "phneakngar-cli-0.0.1.tgz",
    ];

    expect(expectedTarballName("0.0.1")).toBe("phneakngar-cli-0.0.1.tgz");
    expect(findExpectedTarball(entries, "0.0.1")).toBe(
      "phneakngar-cli-0.0.1.tgz",
    );
  });

  it("rejects stale tarballs when the expected version is absent", () => {
    expect(
      findExpectedTarball(["phneakngar-cli-0.0.149.tgz"], "0.0.1"),
    ).toBeUndefined();
  });

  it("requires exact version command output", () => {
    expect(isExpectedVersionOutput("phneakngar version 0.0.1\n", "0.0.1"))
      .toBe(true);
    expect(isExpectedVersionOutput("phneakngar version 0.0.2\n", "0.0.1"))
      .toBe(false);
    expect(isExpectedVersionOutput("prefix phneakngar version 0.0.1", "0.0.1"))
      .toBe(false);
    expect(isExpectedVersionOutput("phneakngar version 0.0.1\nextra", "0.0.1"))
      .toBe(false);
  });

  it("resolves npm global binary shims by platform", () => {
    expect(resolveGlobalBinPath("/tmp/prefix", "linux")).toBe(
      join("/tmp/prefix", "bin", "phneakngar"),
    );
    expect(resolveGlobalBinPath("C:\\prefix", "win32")).toBe(
      win32.join("C:\\prefix", "phneakngar.cmd"),
    );
  });

  it("parses the npm pack JSON files list strictly", () => {
    const output = JSON.stringify([
      {
        files: [
          { path: "package.json" },
          { path: "dist/index.js" },
        ],
      },
    ]);

    expect(parsePackFiles(output)).toEqual(["package.json", "dist/index.js"]);
    expect(() => parsePackFiles("[]")).toThrow(
      "npm pack JSON did not contain a files list",
    );
  });
});
