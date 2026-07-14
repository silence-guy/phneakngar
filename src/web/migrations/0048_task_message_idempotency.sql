-- Compatibility-sensitive forward migration.
-- Remove only byte-identical duplicate deliveries, keeping the earliest durable row.
-- Conflicting payloads for the same (task_id, seq) intentionally remain so the
-- unique index creation fails closed instead of discarding inconsistent history.
DELETE FROM task_message AS duplicate
WHERE EXISTS (
  SELECT 1
  FROM task_message AS keeper
  WHERE keeper.task_id = duplicate.task_id
    AND keeper.seq = duplicate.seq
    AND keeper.type = duplicate.type
    AND keeper.tool = duplicate.tool
    AND keeper.call_id = duplicate.call_id
    AND keeper.content = duplicate.content
    AND keeper.input IS duplicate.input
    AND keeper.output = duplicate.output
    AND (
      keeper.created_at < duplicate.created_at
      OR (keeper.created_at = duplicate.created_at AND keeper.id < duplicate.id)
    )
);

CREATE UNIQUE INDEX task_message_task_seq_unique
  ON task_message(task_id, seq);
