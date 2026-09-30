CREATE TABLE IF NOT EXISTS flow_search(
  workspace_id TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(workspace_id, flow_id)
);
CREATE INDEX IF NOT EXISTS flow_search_by_session ON flow_search(workspace_id, session_id, flow_id);
CREATE VIRTUAL TABLE IF NOT EXISTS flow_search_fts USING fts5(content, content='flow_search', content_rowid='rowid', tokenize='unicode61');
CREATE TRIGGER IF NOT EXISTS flow_search_ai AFTER INSERT ON flow_search BEGIN
  INSERT INTO flow_search_fts(rowid, content) VALUES(new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS flow_search_ad AFTER DELETE ON flow_search BEGIN
  INSERT INTO flow_search_fts(flow_search_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
CREATE TRIGGER IF NOT EXISTS flow_search_au AFTER UPDATE ON flow_search BEGIN
  INSERT INTO flow_search_fts(flow_search_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO flow_search_fts(rowid, content) VALUES(new.rowid, new.content);
END;
INSERT OR IGNORE INTO flow_search(workspace_id, flow_id, session_id, method, url, status, content)
  SELECT workspace_id, id,
    COALESCE(json_extract(payload,'$.sessionId'), ''),
    COALESCE(json_extract(payload,'$.method'), COALESCE(json_extract(payload,'$.request.method'), '')),
    COALESCE(json_extract(payload,'$.url'), COALESCE(json_extract(payload,'$.request.url'), '')),
    COALESCE(json_extract(payload,'$.status'), COALESCE(json_extract(payload,'$.response.status'), '')),
    COALESCE(json_extract(payload,'$.method'), '') || ' ' ||
    COALESCE(json_extract(payload,'$.url'), COALESCE(json_extract(payload,'$.request.url'), '')) || ' ' ||
    COALESCE(json_extract(payload,'$.status'), COALESCE(json_extract(payload,'$.response.status'), ''))
  FROM entities WHERE kind='flow';
PRAGMA user_version = 8;
