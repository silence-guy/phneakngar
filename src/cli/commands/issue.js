import { Command } from "commander";
import { APIClient } from "../lib/client.js";
import { printJSON } from "../lib/output.js";
import { resolveAgentId, readBody } from "../lib/flags.js";
import { resolveClientOpts } from "../lib/resolve-client.js";
const VALID_STATUSES = [
    "todo",
    "in_progress",
    "review",
    "blocked",
    "done",
    "closed",
    "canceled",
    "failed",
];
const KHMER_STATUS_LABELS = {
    todo: "ត្រូវធ្វើ",
    in_progress: "កំពុងដំណើរការ",
    review: "រង់ចាំពិនិត្យ",
    blocked: "ជាប់គាំង",
    done: "រួចរាល់",
    closed: "បានបិទ",
    canceled: "បានបោះបង់",
    failed: "បរាជ័យ",
};
const STATUS_HELP = VALID_STATUSES.map((status) => `${status} (${KHMER_STATUS_LABELS[status]})`).join(", ");
function printIssue(issue) {
    console.log(`${issue.id}  ${issue.status.padEnd(11)}  ${issue.title}`);
}
function printIssueDetail(issue, messages, comments) {
    console.log(`id:              ${issue.id}`);
    console.log(`agent_id:        ${issue.agent_id}`);
    if (issue.claimed_by_agent_id) {
        console.log(`claimed_by:      ${issue.claimed_by_agent_id}`);
        if (issue.claimed_at)
            console.log(`claimed_at:      ${issue.claimed_at}`);
    }
    console.log(`status:          ${issue.status}`);
    console.log(`conversation_id: ${issue.conversation_id}`);
    if (issue.latest_task_id)
        console.log(`latest_task_id:  ${issue.latest_task_id}`);
    console.log(`title:           ${issue.title}`);
    console.log("description:");
    console.log(issue.description || "(no description)");
    const events = messages?.filter((m) => m.role === "event") ?? [];
    if (events.length > 0) {
        console.log("\nevents:");
        for (const m of events) {
            console.log(`  [${m.created_at}] ${m.content}`);
        }
    }
    if (comments && comments.length > 0) {
        console.log("\ncomments:");
        for (const c of comments) {
            console.log(`  [${c.created_at}] (${c.author_type}) ${c.content}`);
        }
    }
}
export function issueCommand() {
    const cmd = new Command("issue").description("Manage assigned issues");
    cmd
        .command("create")
        .description("Create and dispatch an issue to an agent")
        .option("--agent_id <id>", "Agent ID")
        .requiredOption("--title <title>", "Issue title")
        .option("--description <text>", "Issue description")
        .option("--body-file <path>", "Read issue description from a file")
        .option("--json", "Output as JSON")
        .action(async (opts, command) => {
        const agentId = resolveAgentId(opts);
        const { serverUrl, token, workspaceId } = resolveClientOpts(command, { agentId });
        const client = new APIClient(serverUrl, token, workspaceId);
        const description = readBody({ body: opts.description, bodyFile: opts.bodyFile });
        try {
            const res = await client.postJSON("/api/issues", {
                agent_id: agentId,
                title: opts.title,
                description,
            });
            if (opts.json)
                return printJSON(res);
            console.log(`Created ${res.issue.id} — ${res.issue.title}`);
        }
        catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
    cmd
        .command("list")
        .description("List issues for an agent")
        .option("--agent_id <id>", "Agent ID")
        .option("--status <status>", `Filter by status (${STATUS_HELP})`)
        .option("--completed", "Show completed/closed/canceled/failed issues")
        .option("--all", "Show all issues")
        .option("--json", "Output as JSON")
        .action(async (opts, command) => {
        if (opts.status && !VALID_STATUSES.includes(opts.status)) {
            console.error(`Error: invalid status "${opts.status}"`);
            process.exit(1);
        }
        const agentId = resolveAgentId(opts);
        const { serverUrl, token, workspaceId } = resolveClientOpts(command, { agentId });
        const client = new APIClient(serverUrl, token, workspaceId);
        const params = new URLSearchParams({ agentId });
        if (opts.status)
            params.set("status", opts.status);
        if (!opts.all && !opts.status)
            params.set("terminal", opts.completed ? "true" : "false");
        try {
            const issues = await client.getJSON(`/api/issues?${params}`);
            if (opts.json)
                return printJSON(issues);
            if (issues.length === 0) {
                console.log("No issues found.");
                return;
            }
            for (const issue of issues)
                printIssue(issue);
        }
        catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
    cmd
        .command("show")
        .description("Show issue details and conversation")
        .option("--agent_id <id>", "Agent ID")
        .requiredOption("--issue_id <id>", "Issue ID")
        .option("--json", "Output as JSON")
        .action(async (opts, command) => {
        const agentId = resolveAgentId(opts);
        const { serverUrl, token, workspaceId } = resolveClientOpts(command, { agentId });
        const client = new APIClient(serverUrl, token, workspaceId);
        try {
            const res = await client.getJSON(`/api/issues/${opts.issue_id}?agentId=${encodeURIComponent(agentId)}`);
            if (res.issue.agent_id !== agentId) {
                console.error(`Error: issue ${res.issue.id} does not belong to agent ${agentId}`);
                process.exit(1);
            }
            if (opts.json)
                return printJSON(res);
            printIssueDetail(res.issue, res.messages, res.comments);
        }
        catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
    cmd
        .command("update")
        .description("Update issue status or text")
        .option("--agent_id <id>", "Agent ID")
        .requiredOption("--issue_id <id>", "Issue ID")
        .option("--status <status>", `New status (${STATUS_HELP})`)
        .option("--title <title>", "New title")
        .option("--description <text>", "New description")
        .option("--body-file <path>", "Read description from a file")
        .option("--json", "Output as JSON")
        .action(async (opts, command) => {
        if (opts.status && !VALID_STATUSES.includes(opts.status)) {
            console.error(`Error: invalid status "${opts.status}"`);
            process.exit(1);
        }
        const description = readBody({ body: opts.description, bodyFile: opts.bodyFile });
        const body = {};
        if (opts.status)
            body.status = opts.status;
        if (opts.title)
            body.title = opts.title;
        if (description)
            body.description = description;
        if (Object.keys(body).length === 0) {
            console.error("Error: pass at least one of --status, --title, --description, --body-file");
            process.exit(1);
        }
        const agentId = resolveAgentId(opts);
        const { serverUrl, token, workspaceId } = resolveClientOpts(command, { agentId });
        const client = new APIClient(serverUrl, token, workspaceId);
        try {
            const issue = await client.patchJSON(`/api/issues/${opts.issue_id}?agentId=${encodeURIComponent(agentId)}`, body);
            if (opts.json)
                return printJSON(issue);
            printIssue(issue);
        }
        catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
    cmd
        .command("claim")
        .description("Atomically claim an issue for an agent")
        .option("--agent_id <id>", "Agent ID to claim as (or PHNEAKNGAR_AGENT_ID)")
        .requiredOption("--issue_id <id>", "Issue ID")
        .option("--json", "Output as JSON")
        .action(async (opts, command) => {
        const agentId = resolveAgentId(opts);
        const { serverUrl, token, workspaceId } = resolveClientOpts(command, { agentId });
        const client = new APIClient(serverUrl, token, workspaceId);
        try {
            const res = await client.postJSON(`/api/issues/${opts.issue_id}/claim`, { agent_id: agentId });
            if (opts.json)
                return printJSON(res);
            const issue = res.issue;
            console.log(`Claimed ${issue.id} for ${agentId} — ${issue.status}  ${issue.title}`);
        }
        catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
    cmd
        .command("handback")
        .description("Release claim so another agent can take the issue")
        .option("--agent_id <id>", "Only hand back if claimed by this agent (or PHNEAKNGAR_AGENT_ID)")
        .requiredOption("--issue_id <id>", "Issue ID")
        .option("--json", "Output as JSON")
        .action(async (opts, command) => {
        // Optional agent filter: flag/env only; do not force process.exit when absent.
        const agentId = opts.agent_id || process.env.PHNEAKNGAR_AGENT_ID || undefined;
        const { serverUrl, token, workspaceId } = resolveClientOpts(command, agentId ? { agentId } : {});
        const client = new APIClient(serverUrl, token, workspaceId);
        const body = {};
        if (agentId)
            body.agent_id = agentId;
        try {
            const res = await client.postJSON(`/api/issues/${opts.issue_id}/handback`, body);
            if (opts.json)
                return printJSON(res);
            const issue = res.issue;
            console.log(`Handed back ${issue.id} — ${issue.status}  ${issue.title}`);
        }
        catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
    cmd
        .command("comment")
        .description("Append a comment to an issue")
        .option("--agent_id <id>", "Agent ID")
        .requiredOption("--issue_id <id>", "Issue ID")
        .option("--body <text>", "Comment text")
        .option("--body-file <path>", "Read comment from a file")
        .option("--json", "Output as JSON")
        .action(async (opts, command) => {
        const content = readBody({ body: opts.body, bodyFile: opts.bodyFile }).trim();
        if (!content) {
            console.error("Error: pass --body or --body-file");
            process.exit(1);
        }
        const agentId = resolveAgentId(opts);
        const { serverUrl, token, workspaceId } = resolveClientOpts(command, { agentId });
        const client = new APIClient(serverUrl, token, workspaceId);
        try {
            const res = await client.postJSON(`/api/issues/${opts.issue_id}/comments?agentId=${encodeURIComponent(agentId)}`, { content });
            if (opts.json)
                return printJSON(res);
            console.log(`Commented on ${opts.issue_id}`);
        }
        catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
    return cmd;
}
