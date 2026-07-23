import { tmpdir } from "os";
import { join, sep } from "path";
export const isWindows = process.platform === "win32";
export function tempDir(subdir) {
    return join(tmpdir(), subdir);
}
export function isPathContained(parent, child) {
    return child === parent || child.startsWith(parent + sep);
}
