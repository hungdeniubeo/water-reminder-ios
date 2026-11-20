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

-- Notification-first migration
-- Additive and idempotent: keeps the existing device credential and VAPID registration.
CREATE TABLE IF NOT EXISTS beo_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  recipient_name TEXT NOT NULL DEFAULT 'Beo',
  app_title TEXT NOT NULL DEFAULT 'Water ♡',
  home_message TEXT NOT NULL DEFAULT 'Anh gửi em một chút dịu dàng. Nhớ uống nước đều nhé ♡',
  notification_title TEXT NOT NULL DEFAULT 'Water ♡',
  reminder_message TEXT NOT NULL DEFAULT 'Beo ơi, nhớ nhấp một chút nước nha em ♡',
  schedule_enabled INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '21:00',
  interval_minutes INTEGER NOT NULL DEFAULT 120,
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO beo_settings
  (id,recipient_name,reminder_message,schedule_enabled,start_time,end_time,interval_minutes,timezone)
SELECT 1,name,CASE WHEN trim(note_to_partner) <> '' THEN note_to_partner ELSE 'Beo ơi, nhớ nhấp một chút nước nha em ♡' END,
  reminder_enabled,start_time,end_time,interval_minutes,timezone
FROM devices WHERE room_id='water-beo-single-device' ORDER BY created_at,id LIMIT 1;
INSERT OR IGNORE INTO beo_settings (id) VALUES (1);

-- This singleton selects the only authorized receiving device. Old rows stay intact.
CREATE TABLE IF NOT EXISTS beo_receiver (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  device_id TEXT,
  last_seen_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO beo_receiver (id,device_id)
VALUES (1,(SELECT id FROM devices WHERE room_id='water-beo-single-device' ORDER BY created_at,id LIMIT 1));

CREATE TABLE IF NOT EXISTS beo_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  credential_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS beo_pairing (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  replace_existing INTEGER NOT NULL DEFAULT 0,
  consumed_by TEXT,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS beo_rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS beo_messages (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual','scheduled')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted','received','opened','failed')),
  receipt_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  accepted_at INTEGER NOT NULL DEFAULT 0,
  received_at INTEGER NOT NULL DEFAULT 0,
  opened_at INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS beo_messages_recent ON beo_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS beo_messages_retry ON beo_messages(status,next_attempt_at);
