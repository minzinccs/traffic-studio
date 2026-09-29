CREATE TABLE IF NOT EXISTS active_rules (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 rule_set_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 FOREIGN KEY(workspace_id,rule_set_id) REFERENCES entities(workspace_id,id) ON DELETE CASCADE
);
PRAGMA user_version=7;
