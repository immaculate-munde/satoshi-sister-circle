-- Link app users to Supabase Auth accounts (Google / email sign-in).
ALTER TABLE users ADD COLUMN auth_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN email TEXT;
