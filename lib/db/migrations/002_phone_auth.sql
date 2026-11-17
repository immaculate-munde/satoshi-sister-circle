-- Phone-verified identity, one-time codes, and seat-to-phone binding for invites.
ALTER TABLE users ADD COLUMN phone_verified_at TEXT;
CREATE UNIQUE INDEX users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

ALTER TABLE members ADD COLUMN phone TEXT;

CREATE TABLE otp_challenges (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX otp_challenges_phone ON otp_challenges(phone, created_at);
