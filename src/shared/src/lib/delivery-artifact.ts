/**
 * Pure helpers for delivery product artifacts (drafts / digests / reports).
 * No I/O — callers persist via artifact queries + R2.
 */

import {
  ArtifactSource,
  DeliveryArtifactKind,
  type DeliveryArtifactKindType,
} from "../constants";

export type DeliveryContent = {
  content: string;
  kind: DeliveryArtifactKindType;
  title?: string;
};

const KIND_VALUES = new Set<string>(Object.values(DeliveryArtifactKind));

function isDeliveryKind(value: unknown): value is DeliveryArtifactKindType {
  return typeof value === "string" && KIND_VALUES.has(value);
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v !== "string") continue;
    const t = v.replace(/\s+$/g, "").replace(/^\s+/g, "");
    if (t) return t;
  }
  return null;
}

function sanitizeFilenameBase(raw: string): string {
  const cleaned = raw
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/^[_.\-]+|[_.\-]+$/g, "")
    .trim()
    .slice(0, 80);
  return cleaned || "delivery";
}

/** Deterministic artifact id so complete retries stay idempotent per task+kind. */
export function buildDeliveryArtifactId(
  taskId: string,
  kind: DeliveryArtifactKindType = DeliveryArtifactKind.DELIVERY,
): string {
  const safeTask = taskId.replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 64) || "task";
  const safeKind = kind.replace(/[^a-z0-9_\-]/g, "") || DeliveryArtifactKind.DELIVERY;
  return `art_dlv_${safeTask}_${safeKind}`;
}

export function buildDeliveryArtifactFilename(
  kind: DeliveryArtifactKindType,
  title?: string,
): string {
  const base = title ? sanitizeFilenameBase(title) : kind;
  return `${base}.md`;
}

export function buildDeliveryArtifactR2Key(params: {
  workspaceId: string;
  agentId: string;
  conversationId: string;
  artifactId: string;
  filename: string;
}): string {
  const filename = sanitizeFilenameBase(params.filename).replace(/\s+/g, "-");
  return `artifacts/${params.workspaceId}/${params.agentId}/${params.conversationId}/${params.artifactId}/${filename}`;
}

/** UTF-8 byte length for R2 size field without Node Buffer. */
export function utf8ByteLength(content: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(content).byteLength;
  }
  // Fallback for rare environments without TextEncoder.
  let bytes = 0;
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // surrogate pair
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Extract delivery body from a complete-task payload or stored task result.
 * Returns null when there is no durable text worth productizing.
 *
 * Accepts:
 * - plain text
 * - complete-task body objects (`{ output }`, `{ delivery: {...} }`, digest/report/draft)
 * - JSON-stringified task.result (common when replaying stored completion payloads)
 */
export function extractDeliveryContent(result: unknown): DeliveryContent | null {
  if (typeof result === "string") {
    const content = firstNonEmptyString(result);
    if (!content) return null;
    // Stored task.result is often JSON.stringify(complete body). Prefer productizable fields.
    if (
      (content.startsWith("{") && content.endsWith("}")) ||
      (content.startsWith("[") && content.endsWith("]"))
    ) {
      try {
        const parsed: unknown = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          const nested = extractDeliveryContent(parsed);
          if (nested) return nested;
        }
      } catch {
        // fall through — treat as plain delivery text
      }
    }
    return { content, kind: DeliveryArtifactKind.DELIVERY };
  }
  if (!result || typeof result !== "object") return null;

  const r = result as Record<string, unknown>;

  if (r.delivery && typeof r.delivery === "object") {
    const d = r.delivery as Record<string, unknown>;
    const content = firstNonEmptyString(d.content, d.body, d.markdown, d.text, d.output);
    if (content) {
      return {
        content,
        kind: isDeliveryKind(d.kind) ? d.kind : DeliveryArtifactKind.DELIVERY,
        title: firstNonEmptyString(d.title, d.filename) ?? undefined,
      };
    }
  }

  if (typeof r.digest === "string" && firstNonEmptyString(r.digest)) {
    return {
      content: firstNonEmptyString(r.digest)!,
      kind: DeliveryArtifactKind.DIGEST,
      title: firstNonEmptyString(r.title) ?? undefined,
    };
  }
  if (typeof r.report === "string" && firstNonEmptyString(r.report)) {
    return {
      content: firstNonEmptyString(r.report)!,
      kind: DeliveryArtifactKind.REPORT,
      title: firstNonEmptyString(r.title) ?? undefined,
    };
  }
  if (typeof r.draft === "string" && firstNonEmptyString(r.draft)) {
    return {
      content: firstNonEmptyString(r.draft)!,
      kind: DeliveryArtifactKind.DRAFT,
      title: firstNonEmptyString(r.title) ?? undefined,
    };
  }

  const content = firstNonEmptyString(r.output, r.content, r.raw);
  if (!content) return null;

  const kind = isDeliveryKind(r.kind)
    ? r.kind
    : isDeliveryKind(r.delivery_kind)
      ? r.delivery_kind
      : DeliveryArtifactKind.DELIVERY;

  return {
    content,
    kind,
    title: firstNonEmptyString(r.title, r.filename) ?? undefined,
  };
}

export function isDeliveryArtifactSource(source: string | null | undefined): boolean {
  return source === ArtifactSource.DELIVERY;
}

/** Timeline / sheet visibility: agent-uploaded files and delivery products. */
export function isTimelineArtifactSource(source: string | null | undefined): boolean {
  return source === ArtifactSource.AGENT || source === ArtifactSource.DELIVERY || source == null;
}
