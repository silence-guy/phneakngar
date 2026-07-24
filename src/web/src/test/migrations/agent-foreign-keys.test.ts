import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../migrations");

function applyChain(db: Database.Database): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const sql = raw.replace(/-->\s*statement-breakpoint/g, "");
    db.exec(sql);
  }
}

describe("migration chain foreign keys referencing agent", () => {
  it("applies cleanly and lets an agent insert succeed with foreign_keys = ON", () => {
    const db = new Database(":memory:");
    expect(() => applyChain(db)).not.toThrow();

    db.pragma("foreign_keys = ON");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);

    db.exec(`INSERT INTO workspace (id, name, slug) VALUES ('w1', 'W', 'w1')`);

    expect(() =>
      db
        .prepare(
          `INSERT INTO agent (id, workspace_id, name, description, instructions, role_title, responsibility, runtime_mode, visibility, status, max_concurrent_tasks, created_at, updated_at)
           VALUES ('ag1', 'w1', 'Leader', '', '', '', '', 'local', 'private', 'idle', 6, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        )
        .run(),
    ).not.toThrow();

    db.exec(
      `INSERT INTO playbook (id, workspace_id, title, definition, version, status, created_at, updated_at)
       VALUES ('pb1', 'w1', 'SOP', '[]', 1, 'draft', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    );

    expect(() =>
      db
        .prepare(
          `INSERT INTO playbook_run (id, workspace_id, playbook_id, playbook_version, agent_id, snapshot, status, created_at)
           VALUES ('pbr1', 'w1', 'pb1', 1, 'ag1', '[]', 'running', '2026-01-01T00:00:00Z')`,
        )
        .run(),
    ).not.toThrow();

    db.close();
  });
});
