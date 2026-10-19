-- Relay Owner AI: proposed D1/SQLite schema, NOT applied automatically.
-- Apply only after confirming deployment DB bindings and owner authentication.
CREATE TABLE IF NOT EXISTS owner_ai_approvals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  argument_digest TEXT NOT NULL CHECK (length(argument_digest) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_owner_ai_approvals_scope
  ON owner_ai_approvals (workspace_id, user_id, tool_id, expires_at);

CREATE TABLE IF NOT EXISTS owner_ai_audit (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('requested', 'approved', 'denied', 'consumed')),
  approval_id TEXT,
  FOREIGN KEY (approval_id) REFERENCES owner_ai_approvals(id)
);

CREATE INDEX IF NOT EXISTS idx_owner_ai_audit_scope
  ON owner_ai_audit (workspace_id, at DESC);

-- Atomic single-use pattern, executed in a DB transaction:
-- UPDATE owner_ai_approvals SET consumed_at = :now
-- WHERE id = :id AND user_id = :actor AND workspace_id = :workspace
-- AND tool_id = :tool AND argument_digest = :digest
-- AND consumed_at IS NULL AND expires_at > :now
-- RETURNING id;
-- Only if exactly one row was returned, append an audit row in the SAME
-- transaction, commit, and then dispatch the external operation.
-- An outbox/idempotency design is required to safely recover if the
-- external operation fails or the worker crashes after consumption.
