-- Additional scheduling options; existing routines and device credentials are unchanged.
CREATE TABLE IF NOT EXISTS beo_routine_options (
  routine_id TEXT PRIMARY KEY REFERENCES beo_routines(id) ON DELETE CASCADE,
  schedule_json TEXT NOT NULL CHECK(json_valid(schedule_json))
);
