const EMAIL_DRAFT_ROOT = "emails/drafts";

function keySegment(value: string): string {
  return encodeURIComponent(value);
}

export function sanitizeEmailAttachmentFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = basename
    .replace(/[\x00-\x1f\x7f]/g, "_")
    .replace(/["`]/g, "_")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return "attachment.bin";
  return cleaned.slice(0, 180);
}

export function getEmailDraftAttachmentPrefix(workspaceId: string, userId?: string): string {
  const workspacePrefix = `${EMAIL_DRAFT_ROOT}/${keySegment(workspaceId)}/`;
  return userId ? `${workspacePrefix}${keySegment(userId)}/` : workspacePrefix;
}

export function buildEmailDraftAttachmentKey(
  workspaceId: string,
  userId: string,
  draftId: string,
  filename: string,
): string {
  return `${getEmailDraftAttachmentPrefix(workspaceId, userId)}${keySegment(draftId)}/${sanitizeEmailAttachmentFilename(filename)}`;
}

export function isEmailDraftAttachmentKeyForScope(
  key: string,
  workspaceId: string,
  userId?: string,
): boolean {
  if (!key || key.includes("\0") || key.includes("..")) return false;
  return key.startsWith(getEmailDraftAttachmentPrefix(workspaceId, userId));
}
