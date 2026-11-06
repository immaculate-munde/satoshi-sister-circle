-- Chama on Lightning: initial schema (SQLite).
-- Money is always INTEGER minor/settlement units plus an asset tag. Instants are ISO-8601 UTC strings.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  phone TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  display_currency TEXT NOT NULL DEFAULT 'KES' CHECK (display_currency = 'KES'),
  contribution_kes_minor INTEGER NOT NULL CHECK (contribution_kes_minor > 0),
  settlement_asset TEXT NOT NULL CHECK (settlement_asset IN ('BTC_SAT','USD_CENT')),
  frequency TEXT NOT NULL CHECK (frequency IN ('WEEKLY','MONTHLY','CUSTOM')),
  custom_interval_days INTEGER CHECK (custom_interval_days IS NULL OR custom_interval_days BETWEEN 1 AND 365),
  first_due_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  payout_policy TEXT NOT NULL DEFAULT 'ALL_PAID' CHECK (payout_policy = 'ALL_PAID'),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','PAUSED')),
  rules_version INTEGER NOT NULL DEFAULT 1,
  rules_locked_at TEXT,
  provider TEXT NOT NULL,
  provider_account_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (frequency <> 'CUSTOM' OR custom_interval_days IS NOT NULL)
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER','MEMBER')),
  invite_state TEXT NOT NULL CHECK (invite_state IN ('INVITED','JOINED')),
  rotation_position INTEGER NOT NULL CHECK (rotation_position >= 1),
  payout_preference TEXT NOT NULL DEFAULT 'BTC' CHECK (payout_preference IN ('BTC','USD')),
  destination_type TEXT NOT NULL CHECK (destination_type IN ('DEMO_WALLET','FLASH_WALLET')),
  verified_destination_ref TEXT,
  destination_label TEXT,
  destination_verified_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (group_id, rotation_position)
);
CREATE UNIQUE INDEX members_group_user ON members(group_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE fx_quotes (
  id TEXT PRIMARY KEY,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate_decimal TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('LIVE','DEMO')),
  rounding_rule TEXT NOT NULL
);

CREATE TABLE cycles (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  roster_snapshot TEXT NOT NULL,
  recipient_member_id TEXT NOT NULL REFERENCES members(id),
  recipient_destination_snapshot TEXT NOT NULL,
  settlement_asset TEXT NOT NULL CHECK (settlement_asset IN ('BTC_SAT','USD_CENT')),
  target_settlement_units INTEGER NOT NULL CHECK (target_settlement_units > 0),
  display_target_kes_minor INTEGER NOT NULL,
  quote_id TEXT NOT NULL REFERENCES fx_quotes(id),
  opens_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN','FUNDED','PAYOUT_PENDING','PAID_OUT')),
  funded_at TEXT,
  paid_out_at TEXT,
  UNIQUE (group_id, round_number)
);

CREATE TABLE contributions (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  payer_user_id TEXT REFERENCES users(id),
  payer_label TEXT,
  due_kes_minor INTEGER NOT NULL,
  due_settlement_units INTEGER NOT NULL CHECK (due_settlement_units > 0),
  settled_settlement_units INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('PENDING','PAID','LATE')),
  paid_at TEXT,
  winning_invoice_id TEXT,
  UNIQUE (cycle_id, member_id)
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  contribution_id TEXT NOT NULL REFERENCES contributions(id),
  kind TEXT NOT NULL DEFAULT 'CONTRIBUTION' CHECK (kind IN ('CONTRIBUTION','DIASPORA')),
  requested_by_user_id TEXT NOT NULL REFERENCES users(id),
  payer_label TEXT,
  provider TEXT NOT NULL,
  provider_invoice_id TEXT,
  payment_hash TEXT,
  bolt11 TEXT,
  wallet_ref TEXT NOT NULL,
  network TEXT NOT NULL,
  asset TEXT NOT NULL CHECK (asset IN ('BTC_SAT','USD_CENT')),
  amount_units INTEGER NOT NULL CHECK (amount_units > 0),
  quote_id TEXT NOT NULL REFERENCES fx_quotes(id),
  diaspora_quote_id TEXT REFERENCES fx_quotes(id),
  diaspora_source_minor INTEGER,
  diaspora_source_currency TEXT,
  status TEXT NOT NULL CHECK (status IN ('CREATING','PENDING','PAID','EXPIRED','FAILED','UNKNOWN')),
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  settled_units INTEGER,
  create_request_id TEXT NOT NULL UNIQUE,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (provider, payment_hash)
);
CREATE INDEX invoices_contribution ON invoices(contribution_id);
CREATE INDEX invoices_open ON invoices(status) WHERE status IN ('CREATING','PENDING','UNKNOWN','EXPIRED');

CREATE TABLE payouts (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL UNIQUE REFERENCES cycles(id),
  recipient_member_id TEXT NOT NULL REFERENCES members(id),
  destination_snapshot TEXT NOT NULL,
  source_wallet_ref TEXT NOT NULL,
  asset TEXT NOT NULL CHECK (asset IN ('BTC_SAT','USD_CENT')),
  principal_units INTEGER NOT NULL CHECK (principal_units > 0),
  fee_units INTEGER NOT NULL DEFAULT 0,
  fee_asset TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED','PROCESSING','SUCCEEDED','FAILED','UNKNOWN')),
  provider_payment_id TEXT,
  request_id TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_until TEXT,
  next_attempt_at TEXT,
  last_error TEXT,
  needs_operator_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  sent_at TEXT
);

-- Overpayments and late duplicate settlements are a liability, not free group money.
CREATE TABLE overpayments (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  invoice_id TEXT NOT NULL UNIQUE REFERENCES invoices(id),
  asset TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (units > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REFUNDED','CREDITED')),
  created_at TEXT NOT NULL
);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('CONTRIBUTION','PAYOUT','DIASPORA')),
  group_id TEXT NOT NULL REFERENCES groups(id),
  contribution_id TEXT REFERENCES contributions(id),
  payout_id TEXT REFERENCES payouts(id),
  snapshot_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  settled_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX receipts_contribution ON receipts(contribution_id, kind) WHERE contribution_id IS NOT NULL;
CREATE UNIQUE INDEX receipts_payout ON receipts(payout_id) WHERE payout_id IS NOT NULL;

CREATE TRIGGER receipts_immutable BEFORE UPDATE ON receipts
BEGIN SELECT RAISE(ABORT, 'receipts are immutable'); END;

CREATE TABLE ledger_events (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  cycle_id TEXT,
  sequence INTEGER NOT NULL,
  type TEXT NOT NULL,
  canonical_payload TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  actor_ref TEXT NOT NULL,
  UNIQUE (group_id, sequence)
);

CREATE TRIGGER ledger_events_no_update BEFORE UPDATE ON ledger_events
BEGIN SELECT RAISE(ABORT, 'ledger_events are append-only'); END;
CREATE TRIGGER ledger_events_no_delete BEFORE DELETE ON ledger_events
BEGIN SELECT RAISE(ABORT, 'ledger_events are append-only'); END;

CREATE TABLE provider_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  payment_hash TEXT,
  payload_digest TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE (provider, dedupe_key)
);


CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invited_member_id TEXT REFERENCES members(id),
  token_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  max_uses INTEGER NOT NULL CHECK (max_uses >= 1),
  uses INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE idempotency_keys (
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, scope, key)
);

CREATE TABLE worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  last_beat_at TEXT NOT NULL,
  last_reconcile_at TEXT,
  info TEXT
);

-- ---------------------------------------------------------------------------
-- Demo provider state. This is a SIMULATED custodial provider used only when
-- PAYMENTS_PROVIDER=demo. It stands in for Flash's own books, so the app still
-- verifies settlement through the provider interface rather than trusting a click.
-- ---------------------------------------------------------------------------
CREATE TABLE demo_wallets (
  id TEXT PRIMARY KEY,
  owner_label TEXT NOT NULL,
  asset TEXT NOT NULL CHECK (asset IN ('BTC_SAT','USD_CENT')),
  balance_units INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE demo_invoices (
  payment_hash TEXT PRIMARY KEY,
  provider_invoice_id TEXT NOT NULL UNIQUE,
  wallet_id TEXT NOT NULL REFERENCES demo_wallets(id),
  asset TEXT NOT NULL,
  amount_units INTEGER NOT NULL,
  memo TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  payment_request TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','PAID','EXPIRED')),
  paid_units INTEGER,
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE demo_transfers (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  source_wallet_id TEXT NOT NULL,
  destination_wallet_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount_units INTEGER NOT NULL,
  fee_units INTEGER NOT NULL DEFAULT 0,
  memo TEXT NOT NULL,
  payment_hash TEXT,
  created_at TEXT NOT NULL
);
