import { describe, it, expect } from "vitest";
import {
  buildDeliveryArtifactId,
  buildDeliveryArtifactFilename,
  buildDeliveryArtifactR2Key,
  utf8ByteLength,
  extractDeliveryContent,
  isDeliveryArtifactSource,
  isTimelineArtifactSource,
} from "./delivery-artifact";
import { ArtifactSource, DeliveryArtifactKind } from "../constants";

describe("buildDeliveryArtifactId", () => {
  it("is deterministic per task+kind", () => {
    expect(buildDeliveryArtifactId("task_abc", DeliveryArtifactKind.DIGEST)).toBe(
      "art_dlv_task_abc_digest",
    );
    expect(buildDeliveryArtifactId("task_abc", DeliveryArtifactKind.DIGEST)).toBe(
      buildDeliveryArtifactId("task_abc", DeliveryArtifactKind.DIGEST),
    );
  });

  it("defaults kind to delivery", () => {
    expect(buildDeliveryArtifactId("t1")).toBe("art_dlv_t1_delivery");
  });
});

describe("buildDeliveryArtifactFilename", () => {
  it("uses kind when no title", () => {
    expect(buildDeliveryArtifactFilename(DeliveryArtifactKind.REPORT)).toBe("report.md");
  });

  it("sanitizes title", () => {
    expect(buildDeliveryArtifactFilename(DeliveryArtifactKind.DRAFT, "../evil/name")).toBe(
      "evil_name.md",
    );
  });
});

describe("buildDeliveryArtifactR2Key", () => {
  it("includes ownership scope and artifact id", () => {
    const key = buildDeliveryArtifactR2Key({
      workspaceId: "ws1",
      agentId: "ag1",
      conversationId: "cv1",
      artifactId: "art_dlv_t1_delivery",
      filename: "delivery.md",
    });
    expect(key).toBe(
      "artifacts/ws1/ag1/cv1/art_dlv_t1_delivery/delivery.md",
    );
  });
});

describe("utf8ByteLength", () => {
  it("counts ascii and multi-byte characters", () => {
    expect(utf8ByteLength("hi")).toBe(2);
    expect(utf8ByteLength("ភ")).toBeGreaterThan(1);
  });
});

describe("extractDeliveryContent", () => {
  it("extracts complete-task output string", () => {
    expect(extractDeliveryContent({ output: "  Morning brief  " })).toEqual({
      content: "Morning brief",
      kind: DeliveryArtifactKind.DELIVERY,
    });
  });

  it("extracts nested delivery payload", () => {
    expect(
      extractDeliveryContent({
        delivery: { content: "# Digest", kind: "digest", title: "Daily" },
      }),
    ).toEqual({
      content: "# Digest",
      kind: DeliveryArtifactKind.DIGEST,
      title: "Daily",
    });
  });

  it("prefers digest/report/draft fields", () => {
    expect(extractDeliveryContent({ digest: "d1" })?.kind).toBe(DeliveryArtifactKind.DIGEST);
    expect(extractDeliveryContent({ report: "r1" })?.kind).toBe(DeliveryArtifactKind.REPORT);
    expect(extractDeliveryContent({ draft: "x" })?.kind).toBe(DeliveryArtifactKind.DRAFT);
  });

  it("honors kind / delivery_kind on flat payloads", () => {
    expect(
      extractDeliveryContent({ output: "body", kind: DeliveryArtifactKind.REPORT }),
    ).toEqual({
      content: "body",
      kind: DeliveryArtifactKind.REPORT,
    });
    expect(
      extractDeliveryContent({ content: "body", delivery_kind: DeliveryArtifactKind.DRAFT }),
    ).toEqual({
      content: "body",
      kind: DeliveryArtifactKind.DRAFT,
    });
  });

  it("unwraps JSON-stringified complete-task / task.result payloads", () => {
    expect(
      extractDeliveryContent(JSON.stringify({ output: "Morning brief", session_id: "s1" })),
    ).toEqual({
      content: "Morning brief",
      kind: DeliveryArtifactKind.DELIVERY,
    });
    expect(
      extractDeliveryContent(JSON.stringify({ digest: "# Daily", title: "Inbox" })),
    ).toEqual({
      content: "# Daily",
      kind: DeliveryArtifactKind.DIGEST,
      title: "Inbox",
    });
  });

  it("falls back to plain text when JSON has no productizable fields", () => {
    const raw = JSON.stringify({ session_id: "s1", branch_name: "main" });
    expect(extractDeliveryContent(raw)).toEqual({
      content: raw,
      kind: DeliveryArtifactKind.DELIVERY,
    });
  });

  it("returns null for empty payloads", () => {
    expect(extractDeliveryContent(null)).toBeNull();
    expect(extractDeliveryContent({})).toBeNull();
    expect(extractDeliveryContent({ session_id: "s" })).toBeNull();
    expect(extractDeliveryContent("   ")).toBeNull();
  });

  it("accepts raw string result", () => {
    expect(extractDeliveryContent("hello")).toEqual({
      content: "hello",
      kind: DeliveryArtifactKind.DELIVERY,
    });
  });
});

describe("source helpers", () => {
  it("identifies delivery source", () => {
    expect(isDeliveryArtifactSource(ArtifactSource.DELIVERY)).toBe(true);
    expect(isDeliveryArtifactSource(ArtifactSource.AGENT)).toBe(false);
  });

  it("timeline includes agent and delivery", () => {
    expect(isTimelineArtifactSource(ArtifactSource.AGENT)).toBe(true);
    expect(isTimelineArtifactSource(ArtifactSource.DELIVERY)).toBe(true);
    expect(isTimelineArtifactSource(ArtifactSource.ATTACHMENT)).toBe(false);
    expect(isTimelineArtifactSource(null)).toBe(true);
  });
});
