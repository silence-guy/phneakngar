import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { APIClient } from "../lib/client.js";
import { printJSON } from "../lib/output.js";
import { resolveClientOpts } from "../lib/resolve-client.js";
import {
  mergeSkillsByName,
  parseSkillPack,
  skillPackToJson,
  toSkillPack,
  type SkillPackItem,
} from "../lib/skill-pack.js";

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJsonFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

function optionalAgentId(opts: { agent_id?: string }): string | null {
  return opts.agent_id || process.env.PHNEAKNGAR_AGENT_ID || null;
}

export function skillCommand(): Command {
  const cmd = new Command("skill").description("Import/export agent skill packs");

  cmd
    .command("export")
    .description("Export skills as a JSON skill pack (agent_skill row shape)")
    .option("--agent_id <id>", "Agent ID (or set PHNEAKNGAR_AGENT_ID env var)")
    .option("--out <path>", "Output file path (default: skill-pack.json)")
    .option("--json", "Print pack JSON to stdout instead of writing a file")
    .action(async (opts, command) => {
      const outPath = resolve(opts.out ?? "skill-pack.json");
      let skills: SkillPackItem[] = [];
      let source = "empty";
      const agentId = optionalAgentId(opts);

      if (agentId) {
        try {
          const { serverUrl, token, workspaceId } = resolveClientOpts(command, { agentId });
          const client = new APIClient(serverUrl, token, workspaceId);
          const res = await client.getJSON<{
            skills: { name: string; description: string; isGlobal?: boolean }[];
          }>(`/api/agents/${encodeURIComponent(agentId)}/skills`);
          skills = (res.skills ?? []).map((s) => ({
            name: s.name,
            description: s.description ?? "",
            ...(s.isGlobal != null ? { isGlobal: s.isGlobal } : {}),
          }));
          source = `api:agent:${agentId}`;
        } catch (err) {
          if (process.env.PHNEAKNGAR_DEBUG) {
            console.error(
              `skill export API failed, falling back to dry-run: ${err instanceof Error ? err.message : err}`,
            );
          }
        }
      }

      if (source === "empty") {
        // Filesystem-only dry-run stub when API/agent context is unavailable.
        if (existsSync(outPath)) {
          try {
            skills = parseSkillPack(readJsonFile(outPath)).skills;
            source = `local:${outPath}`;
          } catch {
            skills = [];
            source = "dry-run";
          }
        } else {
          skills = [];
          source = "dry-run";
        }
      }

      const pack = toSkillPack(skills, { source });
      if (opts.json) return printJSON(pack);

      writeJsonFile(outPath, skillPackToJson(pack));
      console.log(`Exported ${pack.skills.length} skill(s) → ${outPath}`);
    });

  cmd
    .command("import")
    .description("Import a skill pack (idempotent by name)")
    .requiredOption("--file <path>", "Skill pack JSON path")
    .option("--agent_id <id>", "Agent ID (optional; enables API sync when credentials present)")
    .option("--runtime <runtime>", "Runtime for API sync", "claude")
    .option("--out <path>", "Local pack path to merge into (default: skill-pack.json)")
    .option("--dry-run", "Parse + merge only; do not write or call API")
    .option("--json", "Output merge result as JSON")
    .action(async (opts, command) => {
      const filePath = resolve(opts.file);
      if (!existsSync(filePath)) {
        console.error(`Error: file not found: ${filePath}`);
        process.exit(1);
      }

      let incoming;
      try {
        incoming = parseSkillPack(readJsonFile(filePath));
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }

      const localPath = resolve(opts.out ?? "skill-pack.json");
      let existing: SkillPackItem[] = [];
      if (existsSync(localPath) && localPath !== filePath) {
        try {
          existing = parseSkillPack(readJsonFile(localPath)).skills;
        } catch {
          existing = [];
        }
      }

      const merged = mergeSkillsByName(existing, incoming.skills);
      const pack = toSkillPack(merged, { source: `import:${filePath}` });

      if (opts.dryRun) {
        if (opts.json) return printJSON({ dry_run: true, skills: pack.skills });
        console.log(`Dry-run: would import ${incoming.skills.length} skill(s); merged total ${merged.length}`);
        return;
      }

      // Prefer API wire when agent credentials resolve; otherwise local pack merge only.
      let apiSynced = false;
      const agentId = optionalAgentId(opts);
      if (agentId) {
        try {
          const { serverUrl, token, workspaceId } = resolveClientOpts(command, { agentId });
          const client = new APIClient(serverUrl, token, workspaceId);
          await client.postJSON("/api/chhlat/skills/sync", {
            scope: "agent",
            agent_id: agentId,
            runtime: opts.runtime,
            skills: merged.map((s) => ({ name: s.name, description: s.description })),
            chhlat_id: process.env.PHNEAKNGAR_CHHLAT_ID ?? "cli-skill-import",
          });
          apiSynced = true;
        } catch {
          apiSynced = false;
        }
      }

      writeJsonFile(localPath, skillPackToJson(pack));

      if (opts.json) {
        return printJSON({
          imported: incoming.skills.length,
          total: merged.length,
          api_synced: apiSynced,
          path: localPath,
          skills: pack.skills,
        });
      }

      console.log(
        `Imported ${incoming.skills.length} skill(s) (total ${merged.length}) → ${localPath}` +
          (apiSynced ? " [api synced]" : " [local only]"),
      );
    });

  return cmd;
}
