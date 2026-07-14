import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeError } from "@/lib/middleware/helpers";

function asciiFallbackFilename(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_").trim();
  return fallback || "download";
}

function contentDisposition(disposition: "inline" | "attachment", filename: string): string {
  const fallback = asciiFallbackFilename(filename);
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function isActiveContentType(contentType: string): boolean {
  const mime = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return new Set([
    "application/javascript",
    "application/ecmascript",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/ecmascript",
    "text/html",
    "text/javascript",
  ]).has(mime);
}

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id as string;
  const db = getDb(ctx.env.DB);
  const bucket = ctx.env.EMAIL_BUCKET;

  const row = await queries.artifact.getArtifactForOwner(db, id, ws.workspaceId, ctx.userId);
  if (!row) {
    return writeError("not found", 404);
  }

  const object = await bucket.get(row.r2Key);
  if (!object) {
    return writeError("artifact content not found", 404);
  }

  const download = req.nextUrl.searchParams.get("download");
  const activeContent = isActiveContentType(row.contentType);
  const disposition = download !== null || activeContent ? "attachment" : "inline";
  const headers: Record<string, string> = {
    "Content-Type": activeContent ? "application/octet-stream" : row.contentType,
    "Content-Length": String(row.size),
    "Content-Disposition": contentDisposition(disposition, row.filename),
    "Content-Security-Policy": "sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };

  return new Response(object.body, { headers });
});
