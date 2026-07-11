# @phneakngar/cli

ភ្នាក់ងារ CLI — register machines, run the agent chhlat, and manage agents from the command line.

Client install guide: [INSTALL.md](../../INSTALL.md)

## Install

### Global (recommended on client machines)

```bash
npm install --global @phneakngar/cli
phneakngar version
```

### Without global install

```bash
npx @phneakngar/cli <command>
```

### From a local pack (pre-publish / offline)

```bash
# built by an operator from the monorepo
npm install --global ./phneakngar-cli-0.0.149.tgz
```

## Quick Start

1. Ensure Node.js `>= 20.19.0` and at least one AI runtime (`claude`, `codex`, `opencode`, or `grok`) is installed.
2. Initialize and diagnose:

```bash
phneakngar init
phneakngar doctor
```

3. Authenticate — either browser login or a machine token from the [dashboard](https://phneakngar-web.thatsilenceguy.workers.dev):

```bash
phneakngar login
# or
phneakngar register --token al_xxxxxxxxxxxxxxxxxxxxxxxx
```

4. Start chhlat:

```bash
phneakngar chhlat start
phneakngar status
```

Chhlat runs in the background, polling for tasks and dispatching them to your local AI runtimes (Claude, Codex, OpenCode, or Grok).

### Grok (xAI)

1. Install the [Grok Build CLI](https://x.ai/cli) and put `grok` on your `PATH`.
2. Authenticate with a Grok subscription: `grok login` (or set `XAI_API_KEY` for API-key mode).
3. Start chhlat — it auto-detects `grok` like other providers.
4. Optional overrides: `PHNEAKNGAR_GROK_PATH`, `PHNEAKNGAR_GROK_MODEL`.

## Commands

| Command | Description |
| --- | --- |
| `init` | Create local config (`~/.phneakngar`) and optional server URL |
| `doctor` | Diagnose Node, registration, runtimes, chhlat, and server health |
| `register --token <token>` | Register this machine with your ភ្នាក់ងារ account |
| `login` | Browser device-code login |
| `status` | Registration, chhlat, and AI runtime summary |
| `chhlat start` | Start the background chhlat |
| `chhlat stop` | Stop chhlat |
| `chhlat status` | Check if chhlat is running |
| `logs` | Show chhlat log path and recent lines |
| `email pull` | Download agent emails |
| `email send --to <addr> --subject "..." --body-file <path>` | Send an email |
| `calendar set --event_title "..." --datetime <YYYY-MM-DDTHH:MM>` | Create a scheduled event |
| `issue create --title "..."` | Create and dispatch an issue |
| `sync upload-artifact --conversation_id <id> --file <path>` | Upload a file artifact |
| `config show` | Show current configuration |
| `config set-server <url>` | Persist control plane base URL |
| `config path` | Show config file path |
| `update` | Update CLI to the latest version |
| `version` | Print CLI version |

Run `phneakngar <command> --help` for all subcommand options.

<details>
<summary><strong>chhlat</strong> — manage the always-on agent</summary>

```bash
phneakngar chhlat start               # Start in background
phneakngar chhlat start --foreground  # Start in foreground (for debugging)
phneakngar chhlat stop                # Stop chhlat
phneakngar chhlat status              # Check if chhlat is running
```

</details>

<details>
<summary><strong>logs</strong> — inspect chhlat output</summary>

```bash
phneakngar logs                # path + last 50 lines
phneakngar logs --lines 200    # more history
phneakngar logs --path-only    # print path only
phneakngar logs --list         # list log files
```

</details>

<details>
<summary><strong>email</strong> — pull, send, reply, forward, and manage sender whitelist</summary>

```bash
phneakngar email pull                                # Download inbox
phneakngar email pull --status unread                # Unread only
phneakngar email pull --folder sent                  # Sent emails
phneakngar email set --email_id <id> --status read   # Mark as read

phneakngar email send --to <addr> --subject "Hi" --body-file body.html
phneakngar email send ... --in-reply-to <email_id>                   # Reply to a thread
phneakngar email send ... --attachment report.pdf                    # Attach a file
phneakngar email forward --email_id <id> --to <addr> --note "FYI"

phneakngar email whitelist list              # List allowed senders
phneakngar email whitelist add <email>       # Allow a sender
phneakngar email whitelist delete <email>    # Remove a sender
```

Options: `--from <addr>` to send from a custom mailbox, `--limit <n>` / `--offset <n>` for pagination, `--json` for machine-readable output.

</details>

<details>
<summary><strong>calendar</strong> — schedule one-off or recurring agent events</summary>

When an event fires, a new task is dispatched to the agent with the event title as the prompt.

```bash
phneakngar calendar set --event_title "Daily standup" --datetime 2026-05-16T09:00
phneakngar calendar set ... --repeat 1week --repeat_stop_date 2026-12-31

phneakngar calendar list                              # List upcoming events
phneakngar calendar show --event_id <id>              # Show full detail
phneakngar calendar update --event_id <id> --datetime 2026-05-17T10:00
phneakngar calendar delete --event_id <id>
```

Datetime is always local time (`YYYY-MM-DDTHH:MM`). Repeat intervals: `1hour`, `1day`, `1week`, `1month`, etc.

</details>

<details>
<summary><strong>issue</strong> — create and manage issues assigned to agents</summary>

```bash
phneakngar issue create --title "Fix login bug"
phneakngar issue create --title "Refactor auth" --body-file spec.md

phneakngar issue list                           # Active issues
phneakngar issue list --completed               # Completed/closed issues
phneakngar issue show --issue_id <id>           # Full detail + conversation
phneakngar issue update --issue_id <id> --status done
phneakngar issue comment --issue_id <id> --body "Looks good"
```

Statuses: `todo`, `in_progress`, `review`, `done`, `closed`, `canceled`, `failed`.

</details>

<details>
<summary><strong>config</strong> — manage CLI configuration</summary>

```bash
phneakngar config show              # Show current config
phneakngar config path              # Show config file path
phneakngar config set-server <url>  # Persist control plane URL
```

Config is stored at `~/.phneakngar/config.json` and includes:

- `server_url` — ភ្នាក់ងារ server URL
- `profiles` — per-profile settings with workspace bindings
- `watched_workspaces` — workspaces chhlat monitors (each with `id`, `name`, `token`, `agent_ids`)

</details>

## Global Options

```
--server <url>     Override server URL
--profile <name>   Use a specific config profile
--agent_id <id>    Override agent ID (default: $PHNEAKNGAR_AGENT_ID env var)
```

## Update / uninstall

```bash
phneakngar chhlat stop
npm install --global @phneakngar/cli@latest

npm uninstall --global @phneakngar/cli
# optional: rm -rf ~/.phneakngar
```

## Requirements

- Node.js >= 20.19.0
- At least one AI coding agent CLI on `PATH`

## License

Apache-2.0 — see [LICENSE](../../LICENSE).
