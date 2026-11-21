-- Extra daily/weekly reminders. Idempotent; does not touch current water schedule, VAPID or device tokens.
CREATE TABLE IF NOT EXISTS beo_routines (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  time_local TEXT NOT NULL,
  days_mask INTEGER NOT NULL DEFAULT 127 CHECK(days_mask BETWEEN 1 AND 127),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS beo_routines_enabled_time ON beo_routines(enabled,time_local);
-- Examples remain disabled until admin explicitly enables them.
INSERT OR IGNORE INTO beo_routines (id,label,title,body,time_local,days_mask,enabled) VALUES
('go-work','Đi làm','BEO ƠI, CHUẨN BỊ ĐI LÀM NHA ♡','Chúc em một ngày làm việc thật suôn sẻ nha.','08:00',62,0),
('lunch','Ăn trưa','BEO ƠI, NHỚ ĂN TRƯA NHA ♡','Gần 12 giờ rồi đó, em nghỉ tay đi ăn trưa nha.','11:50',127,0);
