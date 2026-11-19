PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  invite_hash TEXT,
  invite_expires INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'vi',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '21:00',
  interval_minutes INTEGER NOT NULL DEFAULT 120,
  note_to_partner TEXT NOT NULL DEFAULT '',
  push_json TEXT,
  push_endpoint TEXT,
  progress_date TEXT NOT NULL DEFAULT '',
  progress_total INTEGER NOT NULL DEFAULT 0,
  goal INTEGER NOT NULL DEFAULT 2000,
  last_sent_slot TEXT NOT NULL DEFAULT '',
  last_test_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_by_room ON devices(room_id);
CREATE INDEX IF NOT EXISTS devices_to_notify ON devices(reminder_enabled,room_id);