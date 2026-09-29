CREATE TABLE IF NOT EXISTS content_gc (
 workspace_id TEXT NOT NULL, sha256 TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,sha256)
);
PRAGMA user_version=5;
