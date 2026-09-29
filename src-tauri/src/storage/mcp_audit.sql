CREATE TABLE IF NOT EXISTS mcp_audit (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL,
 operation TEXT NOT NULL,
 outcome TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_workspace_time ON mcp_audit(workspace_id,created_at DESC,id DESC);
PRAGMA user_version=6;
