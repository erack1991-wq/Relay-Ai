CREATE TABLE IF NOT EXISTS google_calendar_connections (
  workspace TEXT PRIMARY KEY NOT NULL REFERENCES workspaces(id),
  owner TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT NOT NULL,
  access_expires_at TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_google_calendar_owner ON google_calendar_connections(owner);
