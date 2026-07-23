import { readFileSync, statSync } from "fs";
import { basename } from "path";
const MIME_BY_EXT = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
    ".html": "text/html",
    ".htm": "text/html",
    ".json": "application/json",
    ".csv": "text/csv",
    ".md": "text/markdown",
    ".ts": "text/typescript",
    ".js": "text/javascript",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".xml": "application/xml",
    ".zip": "application/zip",
};
export function guessContentType(filename) {
    const idx = filename.lastIndexOf(".");
    if (idx < 0)
        return "application/octet-stream";
    const ext = filename.slice(idx).toLowerCase();
    return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
export function contentToBuffer(content) {
    if (typeof content === "string") {
        return Buffer.from(content, "base64");
    }
    else if (content instanceof ArrayBuffer) {
        return Buffer.from(new Uint8Array(content));
    }
    return Buffer.from(content);
}
export async function uploadFile(client, filePath, endpoint) {
    let bytes;
    let size;
    try {
        bytes = readFileSync(filePath);
        size = statSync(filePath).size;
    }
    catch (err) {
        throw new Error(`cannot read file "${filePath}": ${err instanceof Error ? err.message : err}`);
    }
    const filename = basename(filePath);
    const contentType = guessContentType(filename);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: contentType }), filename);
    const uploaded = await client.postMultipart(endpoint, form);
    return {
        key: uploaded.key,
        filename: uploaded.filename,
        size: uploaded.size ?? size,
        contentType: uploaded.contentType ?? contentType,
    };
}
