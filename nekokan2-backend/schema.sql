CREATE TABLE IF NOT EXISTS RoomState (
  room_id TEXT PRIMARY KEY,
  password_hash TEXT,
  owner_token TEXT,
  state_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
