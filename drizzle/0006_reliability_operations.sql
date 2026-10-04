CREATE TABLE IF NOT EXISTS provider_events (id TEXT PRIMARY KEY NOT NULL, provider TEXT NOT NULL, event_type TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'received', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_provider_events_status ON provider_events (status, updated);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY NOT NULL, workspace TEXT REFERENCES workspaces(id), kind TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, run_after TEXT NOT NULL, last_error TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs (status, run_after);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, workspace TEXT REFERENCES workspaces(id), actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '', created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_created ON audit_events (workspace, created);
CREATE TABLE IF NOT EXISTS completed_jobs (id TEXT PRIMARY KEY NOT NULL, workspace TEXT NOT NULL REFERENCES workspaces(id), booking TEXT NOT NULL REFERENCES bookings(id), amount TEXT NOT NULL, completed TEXT NOT NULL, created TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_completed_jobs_workspace_booking ON completed_jobs (workspace, booking);
CREATE INDEX IF NOT EXISTS idx_completed_jobs_workspace_completed ON completed_jobs (workspace, completed);
