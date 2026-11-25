-- Optional system policy; additive and idempotent, preserves all existing data.
CREATE TABLE IF NOT EXISTS beo_system_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK(retention_days IN (30,60,90))
);
INSERT OR IGNORE INTO beo_system_settings (id,retention_days) VALUES (1,30);
