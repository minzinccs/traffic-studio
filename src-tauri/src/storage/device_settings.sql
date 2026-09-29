CREATE TABLE IF NOT EXISTS device_settings (
 key TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload))
);
PRAGMA user_version = 4;
