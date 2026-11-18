-- Paste into the Supabase SQL editor if you prefer not to run `npm run db:migrate`.
ALTER TABLE users ADD COLUMN auth_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN email TEXT;
INSERT INTO schema_migrations (name, applied_at)
VALUES ('003_auth_link.sql', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
ON CONFLICT DO NOTHING;
