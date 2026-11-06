import type { Asset } from "../money";

export type PaymentState = "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "UNKNOWN";

export interface CreatedInvoice {
  providerId: string;
  paymentHash: string;
  bolt11: string;
  expiresAt: string;
  amount: string;
  asset: Asset;
}

export interface InvoiceStatus {
  state: PaymentState;
  /** Units actually received, when the provider reports them. */
  paidAmount?: string;
  /** Wallet that received the payment, when the provider reports it. */
  walletId?: string;
  paidAt?: string;
  /** Stable provider event/transaction reference used to dedupe settlement. */
  proofRef?: string;
}

export interface SendResult {
  providerPaymentId: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
  fee: string;
}

export interface FoundPayment {
  providerPaymentId: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
  amount: string;
  fee: string;
  destinationWalletId?: string;
}

export interface ResolvedDestination {
  walletId: string;
  asset: Asset;
  label: string;
}

/** Thrown when the provider definitely did not move funds (safe to retry if retryable). */
export class ProviderRejectedError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ProviderRejectedError";
  }
}

/** Thrown when we cannot know whether the provider acted (timeout, connection reset after send). */
export class ProviderUnknownOutcomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnknownOutcomeError";
  }
}

/**
 * Application contract for a custodial Lightning provider. Implementations live in demo.ts and
 * flash.ts and are only ever called from server code (route handlers, worker, scripts).
 */
export interface PaymentsProvider {
  readonly name: "demo" | "flash";
  /** Human label for the network/environment, shown on invoices and receipts. */
  readonly network: string;
  /**
   * true when findPaymentByRequestId gives a definitive answer (a miss means "never sent").
   * When false, an unknown payout stops for operator review instead of retrying.
   */
  readonly definitiveLookup: boolean;
  /** Wallet that collects contributions for a group in the given asset. */
  collectionWalletId(groupAccountRef: string, asset: Asset): string;

  createInvoice(input: {
    walletId: string;
    asset: Asset;
    amount: string;
    memo: string;
    expiresInSeconds: number;
    requestId: string;
  }): Promise<CreatedInvoice>;

  /** Look up an invoice created earlier with this requestId (recovers uncertain creation). */
  findInvoiceByRequestId?(requestId: string): Promise<CreatedInvoice | null>;

  getInvoiceStatus(invoice: { paymentHash: string; bolt11: string; walletId: string }): Promise<InvoiceStatus>;

  watchInvoice(
    invoice: { paymentHash: string; bolt11: string; walletId: string },
    onUpdate: (s: PaymentState) => void,
  ): Promise<() => void>;

  payInternal(input: {
    sourceWalletId: string;
    destinationWalletId: string;
    asset: Asset;
    amount: string;
    requestId: string;
    memo: string;
  }): Promise<SendResult>;

  payInvoice(input: { sourceWalletId: string; bolt11: string; requestId: string; maxFee: string }): Promise<SendResult>;

  findPaymentByRequestId(input: { sourceWalletId: string; requestId: string; since: string }): Promise<FoundPayment | null>;

  listTransactions(walletId: string, cursor?: string): Promise<{ transactions: unknown[]; nextCursor?: string }>;

  /** Verify a payout destination exists and is in the expected asset. */
  resolveDestination(input: { reference: string; asset: Asset }): Promise<ResolvedDestination>;

  getBalance(walletId: string): Promise<string>;
}
