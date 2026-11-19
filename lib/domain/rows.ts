import type { Asset } from "../money";
import type { Frequency } from "./schedule";

export interface GroupRow {
  id: string;
  number: number;
  name: string;
  owner_user_id: string;
  display_currency: "KES";
  contribution_kes_minor: number;
  settlement_asset: Asset;
  frequency: Frequency;
  custom_interval_days: number | null;
  first_due_at: string;
  timezone: string;
  payout_policy: "ALL_PAID";
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  rules_version: number;
  rules_locked_at: string | null;
  provider: string;
  provider_account_ref: string;
  visibility: "PRIVATE" | "PUBLIC";
  description: string | null;
  created_at: string;
}

export interface MemberRow {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  role: "OWNER" | "MEMBER";
  invite_state: "INVITED" | "JOINED";
  rotation_position: number;
  payout_preference: "BTC" | "USD";
  destination_type: "DEMO_WALLET" | "FLASH_WALLET";
  verified_destination_ref: string | null;
  destination_label: string | null;
  destination_verified_at: string | null;
  created_at: string;
}

export interface CycleRow {
  id: string;
  group_id: string;
  round_number: number;
  roster_snapshot: string;
  recipient_member_id: string;
  recipient_destination_snapshot: string;
  settlement_asset: Asset;
  target_settlement_units: number;
  display_target_kes_minor: number;
  quote_id: string;
  opens_at: string;
  due_at: string;
  status: "OPEN" | "FUNDED" | "PAYOUT_PENDING" | "PAID_OUT";
  funded_at: string | null;
  paid_out_at: string | null;
}

export interface ContributionRow {
  id: string;
  cycle_id: string;
  member_id: string;
  payer_user_id: string | null;
  payer_label: string | null;
  due_kes_minor: number;
  due_settlement_units: number;
  settled_settlement_units: number;
  status: "PENDING" | "PAID" | "LATE";
  paid_at: string | null;
  winning_invoice_id: string | null;
}

export interface InvoiceRow {
  id: string;
  contribution_id: string;
  kind: "CONTRIBUTION" | "DIASPORA";
  requested_by_user_id: string;
  payer_label: string | null;
  provider: string;
  provider_invoice_id: string | null;
  payment_hash: string | null;
  bolt11: string | null;
  wallet_ref: string;
  network: string;
  asset: Asset;
  amount_units: number;
  quote_id: string;
  diaspora_quote_id: string | null;
  diaspora_source_minor: number | null;
  diaspora_source_currency: string | null;
  status: "CREATING" | "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "UNKNOWN";
  expires_at: string;
  paid_at: string | null;
  settled_units: number | null;
  create_request_id: string;
  last_checked_at: string | null;
  created_at: string;
}

export interface PayoutRow {
  id: string;
  cycle_id: string;
  recipient_member_id: string;
  destination_snapshot: string;
  source_wallet_ref: string;
  asset: Asset;
  principal_units: number;
  fee_units: number;
  fee_asset: string;
  status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  provider_payment_id: string | null;
  request_id: string;
  attempts: number;
  lease_owner: string | null;
  lease_until: string | null;
  next_attempt_at: string | null;
  last_error: string | null;
  needs_operator_review: number;
  created_at: string;
  submitted_at: string | null;
  sent_at: string | null;
}

export interface DestinationSnapshot {
  walletId: string;
  label: string;
  type: "DEMO_WALLET" | "FLASH_WALLET";
  verifiedAt: string;
}
