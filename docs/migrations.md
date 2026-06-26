# Migrations

D1 migrations live in `src/web/migrations`. The shared schema lives in `src/shared/src/db/schema.ts`.

## When To Add A Migration

Add a migration whenever a change modifies durable D1 shape or query assumptions:

- New table, column, index, or unique constraint.
- Changed default value.
- Backfill needed for existing rows.
- Query performance depends on a new index.
- Data cleanup is required before new code can safely run.

Do not add a migration for TypeScript-only validators, UI-only changes, local IndexedDB cache shape, or R2 object naming changes unless D1 rows also change.

## Naming

Use the existing numbered style:

```text
0044_short_description.sql
```

Keep descriptions short and behavior-focused.

## Migration Checklist

- Update `src/shared/src/db/schema.ts`.
- Add a matching SQL migration in `src/web/migrations`.
- Add or update query tests under `src/shared/test`.
- If the migration changes runtime behavior, add a route/worker test at the owning package.
- Mention whether the migration is additive, backfill-only, or potentially breaking.

## D1 Commands

Local migration apply:

```bash
pnpm --filter @phneakngar/web exec wrangler d1 migrations apply phneakngar-app --local
```

Remote migration apply:

```bash
pnpm --filter @phneakngar/web exec wrangler d1 migrations apply phneakngar-app --remote
```

Remote migration commands must be run deliberately. Do not hide them inside unrelated scripts.
