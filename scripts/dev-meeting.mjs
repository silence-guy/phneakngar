#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const WEB_DIR = new URL("../src/web", import.meta.url).pathname;
const MEET_CODE_RE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

function d1(sql) {
  // argv array, not a shell string: the SQL text is never re-parsed by /bin/sh, so
  // backticks and $(...) in interpolated values cannot execute.
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "phneakngar-app", "--local", "--json", "--command", sql],
    { cwd: WEB_DIR, stdio: "pipe" },
  ).toString();
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

/** Escape a value for single-quoted SQL literal use. */
function sqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

const code = process.argv[2];
if (!code) {
  console.error("Usage: pnpm dev:meeting <meet-code|url> [title]");
  console.error("  e.g. pnpm dev:meeting wjp-qpjv-kfj");
  console.error("  e.g. pnpm dev:meeting https://meet.google.com/wjp-qpjv-kfj");
  process.exit(1);
}

const meetingUrl = MEET_CODE_RE.test(code)
  ? `https://meet.google.com/${code}`
  : code;

if (!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(meetingUrl)) {
  console.error(`Invalid meet URL/code: ${code}`);
  process.exit(1);
}

const rawTitle = process.argv[3] || "Dev Meeting";
if (rawTitle.length > 200) {
  console.error("Title too long (max 200 chars)");
  process.exit(1);
}
const title = sqlLiteral(rawTitle);

const agents = d1("SELECT id, workspace_id FROM agent LIMIT 1");
if (!agents.length) {
  console.error("No agent found in local DB. Run dev:web first and create an agent.");
  process.exit(1);
}

const { id: agentId, workspace_id: workspaceId } = agents[0];
const meetingId = `ms_${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const now = new Date().toISOString();

d1(`INSERT INTO meeting_session (id, agent_id, workspace_id, title, meeting_url, status, is_whitelisted, participants, scheduled_at, created_at, updated_at) VALUES ('${meetingId}', '${sqlLiteral(agentId)}', '${sqlLiteral(workspaceId)}', '${title}', '${sqlLiteral(meetingUrl)}', 'scheduled', 1, '[]', '${now}', '${now}', '${now}')`);

console.log(`✓ Meeting created: ${meetingId}`);
console.log(`  URL:    ${meetingUrl}`);
console.log(`  Agent:  ${agentId}`);
console.log(`  Status: scheduled (chhlat will claim on next poll)`);
