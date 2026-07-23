import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, realpathSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import { createLogger } from "../lib/logger.js";
import { configDir } from "../lib/config.js";
const log = createLogger({ module: "skill-scanner" });
function getCacheDir() {
    return join(configDir(), "skills");
}
export function parseFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match)
        return null;
    const block = match[1];
    const nameMatch = block.match(/^name:\s*(.+)$/m);
    const descMatch = block.match(/^description:\s*(.+)$/m);
    if (!nameMatch)
        return null;
    return {
        name: nameMatch[1].trim().replace(/^["']|["']$/g, ""),
        description: descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, "") : "",
    };
}
function safeReadDir(dir) {
    try {
        if (!existsSync(dir))
            return [];
        return readdirSync(dir);
    }
    catch {
        return [];
    }
}
function findSkillFiles(baseDir, pattern) {
    const results = [];
    if (!existsSync(baseDir))
        return results;
    if (pattern === "*/SKILL.md") {
        for (const entry of safeReadDir(baseDir)) {
            const skillPath = join(baseDir, entry, "SKILL.md");
            try {
                if (existsSync(skillPath) && statSync(skillPath).isFile()) {
                    results.push(skillPath);
                }
            }
            catch { /* skip */ }
        }
    }
    else if (pattern === "**/skills/*/SKILL.md") {
        walkForSkills(baseDir, results);
    }
    else if (pattern === "*.md") {
        for (const entry of safeReadDir(baseDir)) {
            if (entry.endsWith(".md")) {
                const filePath = join(baseDir, entry);
                try {
                    if (statSync(filePath).isFile()) {
                        results.push(filePath);
                    }
                }
                catch { /* skip */ }
            }
        }
    }
    return results;
}
function walkForSkills(dir, results, depth = 0) {
    if (depth > 5)
        return;
    try {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            try {
                const st = statSync(full);
                if (st.isDirectory()) {
                    if (entry === "skills") {
                        for (const skillDir of safeReadDir(full)) {
                            const skillPath = join(full, skillDir, "SKILL.md");
                            try {
                                if (existsSync(skillPath) && statSync(skillPath).isFile()) {
                                    results.push(skillPath);
                                }
                            }
                            catch { /* skip */ }
                        }
                    }
                    else {
                        walkForSkills(full, results, depth + 1);
                    }
                }
            }
            catch { /* skip */ }
        }
    }
    catch { /* skip */ }
}
function scanFrontmatterSkills(paths) {
    const skills = new Map();
    for (const filePath of paths) {
        try {
            const content = readFileSync(filePath, "utf-8");
            const meta = parseFrontmatter(content);
            if (meta && !skills.has(meta.name)) {
                skills.set(meta.name, meta);
            }
        }
        catch { /* skip */ }
    }
    return Array.from(skills.values());
}
function scanClaudeGlobalSkills() {
    const home = homedir();
    const allSkills = [];
    const directPaths = findSkillFiles(join(home, ".claude", "skills"), "*/SKILL.md");
    allSkills.push(...scanFrontmatterSkills(directPaths));
    const pluginCacheDir = join(home, ".claude", "plugins", "cache");
    const pluginPaths = findSkillFiles(pluginCacheDir, "**/skills/*/SKILL.md");
    const names = new Set(allSkills.map((s) => s.name));
    for (const filePath of pluginPaths) {
        try {
            const content = readFileSync(filePath, "utf-8");
            const meta = parseFrontmatter(content);
            if (meta && !names.has(meta.name)) {
                names.add(meta.name);
                allSkills.push(meta);
            }
        }
        catch { /* skip */ }
    }
    return allSkills;
}
function scanClaudeAgentSkills(workdir) {
    const paths = findSkillFiles(join(workdir, ".claude", "skills"), "*/SKILL.md");
    return scanFrontmatterSkills(paths);
}
function scanCodexGlobalSkills() {
    const home = homedir();
    const allSkills = [];
    const paths = [
        ...findSkillFiles(join(home, ".agents", "skills"), "*/SKILL.md"),
        ...findSkillFiles(join(home, ".codex", "skills", ".system"), "*/SKILL.md"),
    ];
    allSkills.push(...scanFrontmatterSkills(paths));
    const codexPluginDir = join(home, ".codex", "plugins", "cache");
    const pluginPaths = findSkillFiles(codexPluginDir, "**/skills/*/SKILL.md");
    const names = new Set(allSkills.map((s) => s.name));
    for (const filePath of pluginPaths) {
        try {
            const content = readFileSync(filePath, "utf-8");
            const meta = parseFrontmatter(content);
            if (meta && !names.has(meta.name)) {
                names.add(meta.name);
                allSkills.push(meta);
            }
        }
        catch { /* skip */ }
    }
    return allSkills;
}
function scanCodexAgentSkills(workdir) {
    const paths = findSkillFiles(join(workdir, ".agents", "skills"), "*/SKILL.md");
    return scanFrontmatterSkills(paths);
}
function scanOpenCodeMdFiles(dir) {
    const skills = [];
    const files = findSkillFiles(dir, "*.md");
    for (const filePath of files) {
        try {
            const content = readFileSync(filePath, "utf-8");
            const name = basename(filePath, ".md");
            const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
            skills.push({ name, description: firstLine.replace(/^#\s*/, "").trim() });
        }
        catch { /* skip */ }
    }
    return skills;
}
function scanOpenCodeGlobalSkills() {
    const home = homedir();
    const skills = [];
    const names = new Set();
    for (const s of scanOpenCodeMdFiles(join(home, ".config", "opencode", "commands"))) {
        if (!names.has(s.name)) {
            names.add(s.name);
            skills.push(s);
        }
    }
    for (const s of scanOpenCodeMdFiles(join(home, ".config", "opencode", "skills"))) {
        if (!names.has(s.name)) {
            names.add(s.name);
            skills.push(s);
        }
    }
    return skills;
}
function scanOpenCodeAgentSkills(workdir) {
    const skills = [];
    const names = new Set();
    for (const s of scanOpenCodeMdFiles(join(workdir, ".opencode", "commands"))) {
        if (!names.has(s.name)) {
            names.add(s.name);
            skills.push(s);
        }
    }
    for (const s of scanOpenCodeMdFiles(join(workdir, ".opencode", "skills"))) {
        if (!names.has(s.name)) {
            names.add(s.name);
            skills.push(s);
        }
    }
    return skills;
}
/** Grok Build skills use Claude-compatible SKILL.md packages under ~/.grok and ./.grok. */
function scanGrokGlobalSkills() {
    const home = homedir();
    const paths = findSkillFiles(join(home, ".grok", "skills"), "*/SKILL.md");
    return scanFrontmatterSkills(paths);
}
function scanGrokAgentSkills(workdir) {
    const paths = [
        ...findSkillFiles(join(workdir, ".grok", "skills"), "*/SKILL.md"),
        ...findSkillFiles(join(workdir, ".agents", "skills"), "*/SKILL.md"),
    ];
    return scanFrontmatterSkills(paths);
}
function computeHash(skills) {
    return createHash("md5").update(JSON.stringify(skills)).digest("hex");
}
function globalCachePath(chhlatId, runtime) {
    return join(getCacheDir(), "global", chhlatId, `${runtime}.json`);
}
function agentCachePath(agentId, runtime) {
    return join(getCacheDir(), "agents", agentId, `${runtime}.json`);
}
function readCacheHash(filePath) {
    try {
        if (!existsSync(filePath))
            return null;
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        return data.hash ?? null;
    }
    catch {
        return null;
    }
}
function writeCacheFile(filePath, hash, skills) {
    const dir = join(filePath, "..");
    mkdirSync(dir, { recursive: true });
    const data = { hash, skills };
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
export function isClientError(err) {
    if (err instanceof Error) {
        const match = err.message.match(/^HTTP (\d+):/);
        if (match) {
            const status = parseInt(match[1], 10);
            return status >= 400 && status < 500;
        }
    }
    return false;
}
let scanTimer = null;
let scannerConfig = null;
let clientRef = null;
function discoverTargets() {
    if (!scannerConfig)
        return [];
    const rootExists = existsSync(scannerConfig.workspacesRoot);
    const rootReal = rootExists ? realpathSync(scannerConfig.workspacesRoot) : null;
    const targets = [];
    for (const ws of scannerConfig.workspaces) {
        const agentIds = new Set(ws.agentIds);
        // Also discover agents from filesystem (covers agents not yet in config)
        if (rootReal) {
            const wsDir = join(scannerConfig.workspacesRoot, ws.workspaceId);
            try {
                if (existsSync(wsDir)) {
                    for (const dir of readdirSync(wsDir)) {
                        if (existsSync(join(wsDir, dir, "workdir")))
                            agentIds.add(dir);
                    }
                }
            }
            catch { /* skip */ }
        }
        for (const agentId of agentIds) {
            let validWorkdir = null;
            if (rootReal) {
                const workdir = join(scannerConfig.workspacesRoot, ws.workspaceId, agentId, "workdir");
                if (existsSync(workdir)) {
                    try {
                        if (realpathSync(workdir).startsWith(rootReal))
                            validWorkdir = workdir;
                    }
                    catch { /* skip */ }
                }
            }
            for (const runtime of scannerConfig.runtimes) {
                targets.push({ agentId, workdir: validWorkdir, runtime, token: ws.token });
            }
        }
    }
    return targets;
}
function getGlobalScanner(runtime) {
    if (runtime === "claude")
        return scanClaudeGlobalSkills;
    if (runtime === "codex")
        return scanCodexGlobalSkills;
    if (runtime === "grok")
        return scanGrokGlobalSkills;
    return scanOpenCodeGlobalSkills;
}
function getAgentScanner(runtime) {
    if (runtime === "claude")
        return scanClaudeAgentSkills;
    if (runtime === "codex")
        return scanCodexAgentSkills;
    if (runtime === "grok")
        return scanGrokAgentSkills;
    return scanOpenCodeAgentSkills;
}
function runScan() {
    if (!scannerConfig || !clientRef)
        return;
    if (scannerConfig.workspaces.length === 0)
        return;
    // 1. Scan + sync global skills per runtime to ALL workspaces
    for (const runtime of scannerConfig.runtimes) {
        try {
            const skills = getGlobalScanner(runtime)();
            const hash = computeHash(skills);
            const prevHash = readCacheHash(globalCachePath(scannerConfig.chhlatId, runtime));
            if (prevHash !== hash) {
                const skillItems = skills.map((s) => ({ name: s.name, description: s.description }));
                log.debug(`Syncing global ${runtime} — ${skills.length} skills`);
                const chhlatId = scannerConfig.chhlatId;
                const syncPromises = scannerConfig.workspaces.map((ws) => clientRef.syncSkills(ws.token, {
                    scope: "global",
                    runtime,
                    skills: skillItems,
                    chhlat_id: chhlatId,
                }));
                Promise.all(syncPromises).then(() => {
                    writeCacheFile(globalCachePath(chhlatId, runtime), hash, skills);
                }).catch((e) => {
                    if (isClientError(e)) {
                        writeCacheFile(globalCachePath(chhlatId, runtime), hash, skills);
                    }
                    log.debug("Global skill sync failed", e);
                });
            }
        }
        catch (e) {
            log.debug(`Global scan error for ${runtime}`, e);
        }
    }
    // 2. Scan + sync agent-scope skills per agent (only if workdir exists)
    const targets = discoverTargets();
    for (const target of targets) {
        if (!target.workdir)
            continue;
        try {
            const skills = getAgentScanner(target.runtime)(target.workdir);
            const hash = computeHash(skills);
            const prevHash = readCacheHash(agentCachePath(target.agentId, target.runtime));
            if (prevHash !== hash) {
                const skillItems = skills.map((s) => ({ name: s.name, description: s.description }));
                log.debug(`Syncing ${target.agentId}:${target.runtime} — ${skills.length} agent skills`);
                clientRef.syncSkills(target.token, {
                    scope: "agent",
                    agent_id: target.agentId,
                    runtime: target.runtime,
                    skills: skillItems,
                }).then(() => {
                    writeCacheFile(agentCachePath(target.agentId, target.runtime), hash, skills);
                }).catch((e) => {
                    if (isClientError(e)) {
                        writeCacheFile(agentCachePath(target.agentId, target.runtime), hash, skills);
                    }
                    log.debug("Agent skill sync failed", e);
                });
            }
        }
        catch (e) {
            log.debug(`Agent scan error for ${target.agentId}:${target.runtime}`, e);
        }
    }
}
export function startSkillScanner(client, config, interval = 60_000) {
    clientRef = client;
    scannerConfig = config;
    runScan();
    scanTimer = setInterval(runScan, interval);
}
export function stopSkillScanner() {
    if (scanTimer) {
        clearInterval(scanTimer);
        scanTimer = null;
    }
}
