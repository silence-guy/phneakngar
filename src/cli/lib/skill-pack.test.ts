import { describe, it, expect } from "vitest";
import {
  parseSkillPack,
  mergeSkillsByName,
  toSkillPack,
  skillPackToJson,
} from "./skill-pack";

describe("parseSkillPack", () => {
  it("parses valid pack", () => {
    const pack = parseSkillPack({
      version: 1,
      skills: [{ name: "a", description: "A" }],
    });
    expect(pack.skills).toEqual([{ name: "a", description: "A" }]);
  });

  it("rejects invalid shapes", () => {
    expect(() => parseSkillPack(null)).toThrow(/object/);
    expect(() => parseSkillPack({ skills: "x" })).toThrow(/array/);
    expect(() => parseSkillPack({ skills: [{ description: "no name" }] })).toThrow(/name/);
  });
});

describe("mergeSkillsByName", () => {
  it("is idempotent for same name+description", () => {
    const base = [{ name: "a", description: "A" }];
    const once = mergeSkillsByName(base, [{ name: "a", description: "A" }]);
    const twice = mergeSkillsByName(once, [{ name: "a", description: "A" }]);
    expect(once).toEqual([{ name: "a", description: "A" }]);
    expect(twice).toEqual(once);
  });

  it("updates description for existing name and appends new names", () => {
    const merged = mergeSkillsByName(
      [{ name: "a", description: "old" }],
      [
        { name: "a", description: "new" },
        { name: "b", description: "B" },
      ],
    );
    expect(merged).toEqual([
      { name: "a", description: "new" },
      { name: "b", description: "B" },
    ]);
  });
});

describe("toSkillPack / skillPackToJson", () => {
  it("serializes pack JSON", () => {
    const pack = toSkillPack([{ name: "x", description: "X" }], {
      source: "api",
      exportedAt: "2026-01-01T00:00:00.000Z",
    });
    const json = skillPackToJson(pack);
    expect(JSON.parse(json)).toEqual(pack);
  });
});
