import { describe, it, expect } from "vitest";
import type { Artifact } from "@phneakngar/shared";
import { filterDeliveryArtifacts } from "./delivery-artifacts-panel";

function art(partial: Partial<Artifact> & Pick<Artifact, "id" | "source">): Artifact {
  return {
    conversation_id: "c1",
    agent_id: "a1",
    task_id: null,
    filename: "file.md",
    content_type: "text/markdown",
    size: 10,
    has_thumbnail: false,
    created_at: "2026-07-16T00:00:00.000Z",
    ...partial,
  };
}

describe("filterDeliveryArtifacts", () => {
  const rows = [
    art({ id: "1", source: "delivery", task_id: "t1", filename: "a.md", created_at: "2026-07-16T01:00:00.000Z" }),
    art({ id: "2", source: "agent", task_id: "t1", filename: "b.md" }),
    art({ id: "3", source: "delivery", task_id: "t2", filename: "c.md", created_at: "2026-07-16T02:00:00.000Z" }),
    art({ id: "4", source: "attachment", filename: "d.md" }),
    art({ id: "5", source: "delivery", task_id: null, filename: "legacy.md", created_at: "2026-07-16T00:30:00.000Z" }),
  ];

  it("keeps only delivery source", () => {
    const out = filterDeliveryArtifacts(rows);
    expect(out.map((a) => a.id)).toEqual(["3", "1", "5"]);
  });

  it("filters by task_id when provided", () => {
    const out = filterDeliveryArtifacts(rows, "t1");
    expect(out.map((a) => a.id)).toEqual(["1"]);
  });

  it("returns empty when none match", () => {
    expect(filterDeliveryArtifacts(rows, "missing")).toEqual([]);
  });

  it("does not include delivery rows with null task when filtering by task", () => {
    const out = filterDeliveryArtifacts(rows, "t2");
    expect(out.map((a) => a.id)).toEqual(["3"]);
    expect(out.every((a) => a.task_id === "t2")).toBe(true);
  });
});
