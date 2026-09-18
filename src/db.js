const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

const dbDir = path.dirname(config.dbPath);
if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    sn          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    name        TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS card_mappings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id       TEXT NOT NULL,
    device_sn       TEXT NOT NULL,
    device_user_id  TEXT NOT NULL,
    personnel_id    TEXT NOT NULL,
    personnel_name  TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(device_sn, device_user_id)
  );

  CREATE TABLE IF NOT EXISTS attendance_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id       TEXT,
    device_sn       TEXT NOT NULL,
    device_user_id  TEXT NOT NULL,
    personnel_id    TEXT,
    event_time      TEXT NOT NULL,
    raw_status      TEXT,
    verify_mode     TEXT,
    direction       TEXT,
    synced          INTEGER NOT NULL DEFAULT 0,
    sync_error      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(device_sn, device_user_id, event_time, raw_status)
  );

  CREATE INDEX IF NOT EXISTS idx_events_tenant ON attendance_events(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_events_personnel ON attendance_events(personnel_id, event_time);
`);

module.exports = db;
