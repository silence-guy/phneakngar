/**
 * Delivery artifact hook: persist task output as a first-class artifact row
 * (draft / digest / report) linked to the producing task.
 *
 * Stateless — all durable state in D1 + R2. Idempotent via deterministic id.
 */

import {
  queries,
  ArtifactSource,
  buildDeliveryArtifactId,
  buildDeliveryArtifactFilename,
  buildDeliveryArtifactR2Key,
  utf8ByteLength,
  extractDeliveryContent,
  type Artifact,
  type DeliveryArtifactKindType,
  type Database,
} from "@phneakngar/shared";
import { log } from "@/lib/logger";
import { broadcastToUser } from "@/lib/broadcast";

type R2Like = {
  put: (
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
};

export type CreateTaskDeliveryArtifactInput = {
  workspaceId: string;
  agentId: string;
  conversationId: string;
  taskId: string;
  /** Complete-task body or stored task.result. */
  result: unknown;
  /** Force kind when extractor cannot infer. */
  kind?: DeliveryArtifactKindType;
  contentType?: string;
  /** Owner to receive artifact.uploaded WS event. */
  ownerUserId?: string | null;
};

export type CreateTaskDeliveryArtifactResult = {
  artifact: Artifact;
  created: boolean;
} | null;

/**
 * Create (or return existing) delivery artifact for a completed task.
 * Returns null when result has no productizable text content.
 */
export async function createTaskDeliveryArtifact(
  db: Database,
  bucket: R2Like | null | undefined,
  input: CreateTaskDeliveryArtifactInput,
): Promise<CreateTaskDeliveryArtifactResult> {
  if (!bucket) return null;

  const extracted = extractDeliveryContent(input.result);
  if (!extracted) return null;

  const kind = input.kind ?? extracted.kind;
  const content = extracted.content;
  const filename = buildDeliveryArtifactFilename(kind, extracted.title);
  const contentType = input.contentType ?? "text/markdown; charset=utf-8";
  const artifactId = buildDeliveryArtifactId(input.taskId, kind);
  const size = utf8ByteLength(content);
  const r2Key = buildDeliveryArtifactR2Key({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    conversationId: input.conversationId,
    artifactId,
    filename,
  });

  await bucket.put(r2Key, content, {
    httpMetadata: { contentType },
  });

  const { artifact: row, created } = await queries.artifact.createArtifactIfAbsent(db, {
    id: artifactId,
    conversationId: input.conversationId,
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    filename,
    contentType,
    size,
    r2Key,
    source: ArtifactSource.DELIVERY,
  });

  const response = queries.artifact.artifactToResponse(row);

  if (created && input.ownerUserId) {
    broadcastToUser(input.ownerUserId, {
      type: "artifact.uploaded",
      conversationId: input.conversationId,
      artifact: response,
    }).catch(() => {});
  }

  return { artifact: response, created };
}

/**
 * Best-effort wrapper for task-complete hooks. Never throws into the lifecycle path.
 */
export async function maybeCreateTaskDeliveryArtifact(
  db: Database,
  bucket: R2Like | null | undefined,
  input: CreateTaskDeliveryArtifactInput,
): Promise<CreateTaskDeliveryArtifactResult> {
  try {
    return await createTaskDeliveryArtifact(db, bucket, input);
  } catch (err) {
    log.warn("delivery artifact: create failed", {
      taskId: input.taskId,
      workspaceId: input.workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
