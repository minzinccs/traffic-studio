CREATE TABLE IF NOT EXISTS device_certificates (
 id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE,
 pem TEXT NOT NULL, der BLOB NOT NULL, protected_key BLOB NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, installed_by_app INTEGER NOT NULL DEFAULT 0, operation TEXT NOT NULL DEFAULT 'idle'
);
PRAGMA user_version = 3;
