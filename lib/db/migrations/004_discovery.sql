-- Public chama directory + join requests.
ALTER TABLE groups ADD COLUMN visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE','PUBLIC'));
ALTER TABLE groups ADD COLUMN description TEXT;

CREATE TABLE join_requests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  member_id TEXT REFERENCES members(id),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
-- One open request per person per chama.
CREATE UNIQUE INDEX join_requests_one_pending ON join_requests(group_id, user_id) WHERE status = 'PENDING';
CREATE INDEX join_requests_group ON join_requests(group_id, status);
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
