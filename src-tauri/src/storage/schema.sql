CREATE TABLE IF NOT EXISTS workspaces (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entities (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, schema_version INTEGER NOT NULL,
 revision INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), updated_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS entities_by_kind ON entities(workspace_id,kind,updated_at,id);
CREATE TABLE IF NOT EXISTS entity_links (
 workspace_id TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL, relation TEXT NOT NULL,
 PRIMARY KEY(workspace_id,from_id,to_id,relation),
 FOREIGN KEY(workspace_id,from_id) REFERENCES entities(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,to_id) REFERENCES entities(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS blobs (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 id TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, mime_type TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS migrations (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 source_id TEXT NOT NULL, digest TEXT NOT NULL, imported_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,source_id)
);
CREATE TABLE IF NOT EXISTS secrets (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 id TEXT NOT NULL, protected BLOB NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,id)
);
PRAGMA user_version = 1;
