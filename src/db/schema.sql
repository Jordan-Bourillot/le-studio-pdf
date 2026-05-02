CREATE TABLE IF NOT EXISTS license (
    key TEXT PRIMARY KEY,
    activated_at TEXT,
    machine_id TEXT,
    status TEXT NOT NULL DEFAULT 'trial',
    version_purchased TEXT,
    trial_started_at TEXT,
    trial_ends_at TEXT
);

CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS recent_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    filename TEXT NOT NULL,
    last_opened TEXT NOT NULL,
    last_action TEXT,
    page_count INTEGER
);

CREATE INDEX IF NOT EXISTS idx_recent_last_opened
    ON recent_files(last_opened DESC);

CREATE TABLE IF NOT EXISTS presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    image_blob BLOB,
    certificate_path TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stamps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT,
    image_blob BLOB,
    config_json TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    duration_ms INTEGER,
    success INTEGER NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
);
