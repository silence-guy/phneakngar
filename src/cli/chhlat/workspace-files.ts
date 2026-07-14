import { readdir, stat, readFile, realpath } from "fs/promises";
import { join, resolve, extname, relative, sep, isAbsolute } from "path";
import type { WorkspaceFileEntry } from "@phneakngar/shared";

const SKIP_DIRS = new Set([".git", "node_modules", ".next", ".wrangler", "__pycache__", ".venv"]);

const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".js", ".ts", ".tsx", ".jsx",
  ".py", ".rb", ".go", ".rs", ".toml", ".yaml", ".yml",
  ".html", ".css", ".scss", ".sh", ".bash", ".zsh",
  ".env", ".cfg", ".ini", ".xml", ".svg", ".sql",
  ".jsonl", ".log", ".csv",
]);

const MAX_FILE_SIZE = 1_048_576; // 1MB

export async function readDirectoryTree(
  dirPath: string,
  basePath: string,
  logicalDirPath = dirPath,
): Promise<WorkspaceFileEntry[]> {
  let entries;
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(basePath);
    const canonicalDir = await realpath(dirPath);
    if (!isContainedPath(canonicalRoot, canonicalDir)) return [];
    entries = await readdir(canonicalDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: WorkspaceFileEntry[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = join(dirPath, entry.name);
    let info;
    try {
      const canonicalTarget = await realpath(fullPath);
      if (!isContainedPath(canonicalRoot, canonicalTarget)) continue;
      info = await stat(canonicalTarget);
    } catch {
      continue;
    }

    const isDirectory = info.isDirectory();
    if (!isDirectory) {
      const ext = extname(entry.name).toLowerCase();
      if (ext !== "" && !TEXT_EXTENSIONS.has(ext)) continue;
    }

    results.push({
      name: entry.name,
      path: relative(basePath, join(logicalDirPath, entry.name)),
      isDirectory,
      size: isDirectory ? 0 : info.size,
      modifiedAt: info.mtime.toISOString(),
    });
  }

  results.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
  return results;
}

export async function readFileContent(
  filePath: string,
): Promise<{ content: string | null; isBinary: boolean }> {
  const info = await stat(filePath);
  if (info.isDirectory()) throw new Error("Cannot read a directory");
  if (info.size > MAX_FILE_SIZE) throw new Error("File too large (>1MB)");

  const ext = extname(filePath).toLowerCase();
  if (ext !== "" && !TEXT_EXTENSIONS.has(ext)) {
    return { content: null, isBinary: true };
  }

  const content = await readFile(filePath, "utf-8");
  return { content, isBinary: false };
}

function isContainedPath(canonicalRoot: string, canonicalTarget: string): boolean {
  const pathFromRoot = relative(canonicalRoot, canonicalTarget);
  return pathFromRoot === "" || (
    pathFromRoot !== ".."
    && !pathFromRoot.startsWith(`..${sep}`)
    && !isAbsolute(pathFromRoot)
  );
}

/**
 * Resolve a requested path through symlinks and allow it only when the
 * canonical target remains inside the canonical agent worktree. Safe in-tree
 * symlinks are supported; broken or escaping symlinks are rejected.
 */
export async function validatePath(agentWorkdir: string, requestedPath: string): Promise<string | null> {
  const lexicalTarget = resolve(agentWorkdir, requestedPath);
  try {
    const [canonicalRoot, canonicalTarget] = await Promise.all([
      realpath(agentWorkdir),
      realpath(lexicalTarget),
    ]);
    return isContainedPath(canonicalRoot, canonicalTarget) ? canonicalTarget : null;
  } catch {
    return null;
  }
}
