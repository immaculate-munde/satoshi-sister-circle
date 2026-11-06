import type { Asset } from "../money";
import {
  type CreatedInvoice,
  type FoundPayment,
  type InvoiceStatus,
  type PaymentState,
  type PaymentsProvider,
  ProviderRejectedError,
  ProviderUnknownOutcomeError,
  type SendResult,
} from "./provider";

/**
 * Flash (Galoy-based) GraphQL adapter.
 *
 * STATUS: written against the operations listed in the research "Flash API Primer"
 * (lnInvoiceCreate, lnUsdInvoiceCreate, lnInvoicePaymentStatus, intraLedgerPaymentSend,
 * intraLedgerUsdPaymentSend, me.defaultAccount.transactions, accountDefaultWallet). It has NOT
 * been executed against api.test.flashapp.me from this repository yet. Before the live demo run
 * `npm run flash:smoke`, snapshot the schema to scripts/flash-schema.graphql and fix any drift
 * here. Nothing outside this file knows Flash operation names.
 */

export interface FlashOptions {
  graphqlUrl: string;
  apiKey: string;
  btcWalletId: string;
  usdWalletId: string;
  network: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface GqlError {
  message: string;
  code?: string;
  extensions?: { code?: string; retryAfterSeconds?: number };
}

const Q = {
  wallets: /* GraphQL */ `
    query Wallets { me { defaultAccount { wallets { id walletCurrency balance } } } }`,
  lnInvoiceCreate: /* GraphQL */ `
    mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
      lnInvoiceCreate(input: $input) {
        invoice { paymentRequest paymentHash satoshis }
        errors { message code }
      }
    }`,
  lnUsdInvoiceCreate: /* GraphQL */ `
    mutation LnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {
      lnUsdInvoiceCreate(input: $input) {
        invoice { paymentRequest paymentHash satoshis }
        errors { message code }
      }
    }`,
  paymentStatus: /* GraphQL */ `
    query LnInvoicePaymentStatus($input: LnInvoicePaymentStatusInput!) {
      lnInvoicePaymentStatus(input: $input) { status errors { message } }
    }`,
  intraLedgerBtc: /* GraphQL */ `
    mutation IntraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {
      intraLedgerPaymentSend(input: $input) { status errors { message code } }
    }`,
  intraLedgerUsd: /* GraphQL */ `
    mutation IntraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {
      intraLedgerUsdPaymentSend(input: $input) { status errors { message code } }
    }`,
  feeProbe: /* GraphQL */ `
    mutation LnInvoiceFeeProbe($input: LnInvoiceFeeProbeInput!) {
      lnInvoiceFeeProbe(input: $input) { amount errors { message } }
    }`,
  lnPay: /* GraphQL */ `
    mutation LnInvoicePaymentSend($input: LnInvoicePaymentSendInput!) {
      lnInvoicePaymentSend(input: $input) { status errors { message code } }
    }`,
  transactions: /* GraphQL */ `
    query Transactions($first: Int!, $after: String, $walletIds: [WalletId]) {
      me {
        defaultAccount {
          transactions(first: $first, after: $after, walletIds: $walletIds) {
            pageInfo { hasNextPage endCursor }
            edges {
              cursor
              node {
                id status direction memo createdAt
                settlementAmount settlementFee settlementCurrency
                initiationVia {
                  __typename
                  ... on InitiationViaLn { paymentHash }
                  ... on InitiationViaIntraLedger { counterPartyWalletId }
                }
              }
            }
          }
        }
      }
    }`,
  defaultWallet: /* GraphQL */ `
    query AccountDefaultWallet($username: Username!, $walletCurrency: WalletCurrency) {
      accountDefaultWallet(username: $username, walletCurrency: $walletCurrency) { id walletCurrency }
    }`,
};

interface TxNode {
  id: string;
  status: "SUCCESS" | "PENDING" | "FAILURE";
  direction: "SEND" | "RECEIVE";
  memo: string | null;
  createdAt: number;
  settlementAmount: number;
  settlementFee: number;
  settlementCurrency: "BTC" | "USD";
  initiationVia: { __typename: string; paymentHash?: string; counterPartyWalletId?: string };
}

const sendStatus = (s: string): SendResult["status"] =>
  s === "SUCCESS" || s === "ALREADY_PAID" ? "SUCCEEDED" : s === "PENDING" ? "PENDING" : "FAILED";

export class FlashProvider implements PaymentsProvider {
  readonly name = "flash" as const;
  readonly network: string;
  // Flash idempotency for intraLedger sends is unconfirmed; lookup is by memo over tx history, which
  // is not definitive. Unknown payouts therefore stop for operator review.
  readonly definitiveLookup = false;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: FlashOptions) {
    this.network = `Flash test (${opts.network})`;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  collectionWalletId(_groupAccountRef: string, asset: Asset): string {
    return asset === "BTC_SAT" ? this.opts.btcWalletId : this.opts.usdWalletId;
  }

  /** Mutations that move money must not be retried blindly: a transport failure is an unknown outcome. */
  private async gql<T>(query: string, variables: Record<string, unknown>, opts: { movesMoney?: boolean } = {}): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 15000);
    let res: Response;
    try {
      res = await this.fetchImpl(this.opts.graphqlUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "X-API-KEY": this.opts.apiKey },
        body: JSON.stringify({ query, variables }),
        signal: ctrl.signal,
      });
    } catch (e) {
      const msg = `Flash transport error: ${(e as Error).name}`;
      if (opts.movesMoney) throw new ProviderUnknownOutcomeError(msg);
      throw new ProviderRejectedError(msg, true);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "30");
      throw new ProviderRejectedError("Flash rate limited", true, retryAfter);
    }
    if (res.status >= 500) {
      if (opts.movesMoney) throw new ProviderUnknownOutcomeError(`Flash HTTP ${res.status}`);
      throw new ProviderRejectedError(`Flash HTTP ${res.status}`, true);
    }
    if (!res.ok) throw new ProviderRejectedError(`Flash HTTP ${res.status}`, false);
    let body: { data?: T; errors?: GqlError[] };
    try {
      body = await res.json();
    } catch {
      if (opts.movesMoney) throw new ProviderUnknownOutcomeError("Flash returned unreadable body");
      throw new ProviderRejectedError("Flash returned unreadable body", true);
    }
    if (body.errors?.length) {
      const e = body.errors[0];
      const code = e.extensions?.code ?? e.code;
      if (code === "TOO_MANY_REQUESTS") {
        throw new ProviderRejectedError("Flash rate limited", true, e.extensions?.retryAfterSeconds ?? 30);
      }
      // Top-level GraphQL errors (validation/auth) happen before execution: nothing moved.
      throw new ProviderRejectedError(`Flash error: ${sanitize(e.message)}`, false);
    }
    if (!body.data) throw new ProviderRejectedError("Flash returned no data", true);
    return body.data;
  }

  async listWallets() {
    const d = await this.gql<{ me: { defaultAccount: { wallets: { id: string; walletCurrency: string; balance: number }[] } } }>(
      Q.wallets,
      {},
    );
    return d.me.defaultAccount.wallets;
  }

  async createInvoice(input: {
    walletId: string;
    asset: Asset;
    amount: string;
    memo: string;
    expiresInSeconds: number;
    requestId: string;
  }): Promise<CreatedInvoice> {
    const isBtc = input.asset === "BTC_SAT";
    const expiresInMinutes = Math.max(1, Math.round(input.expiresInSeconds / 60));
    const d = await this.gql<Record<string, { invoice?: { paymentRequest: string; paymentHash: string }; errors: GqlError[] }>>(
      isBtc ? Q.lnInvoiceCreate : Q.lnUsdInvoiceCreate,
      {
        input: {
          walletId: input.walletId,
          amount: Number(input.amount),
          // requestId in memo lets reconciliation recover an uncertain invoice creation.
          memo: `${input.memo} [${input.requestId.slice(0, 8)}]`,
          expiresIn: expiresInMinutes,
        },
      },
    );
    const payload = d[isBtc ? "lnInvoiceCreate" : "lnUsdInvoiceCreate"];
    if (payload.errors?.length || !payload.invoice) {
      throw new ProviderRejectedError(`Invoice creation failed: ${sanitize(payload.errors?.[0]?.message)}`, false);
    }
    return {
      providerId: payload.invoice.paymentHash,
      paymentHash: payload.invoice.paymentHash,
      bolt11: payload.invoice.paymentRequest,
      expiresAt: new Date(Date.now() + expiresInMinutes * 60_000).toISOString(),
      amount: input.amount,
      asset: input.asset,
    };
  }

  async getInvoiceStatus(invoice: { paymentHash: string; bolt11: string; walletId: string }): Promise<InvoiceStatus> {
    const d = await this.gql<{ lnInvoicePaymentStatus: { status: string; errors: GqlError[] } }>(Q.paymentStatus, {
      input: { paymentRequest: invoice.bolt11 },
    });
    const status = d.lnInvoicePaymentStatus.status;
    if (status !== "PAID") return { state: (status === "EXPIRED" ? "EXPIRED" : status === "PENDING" ? "PENDING" : "UNKNOWN") };
    // Confirm amount + destination wallet from the transaction history, not just the status flag.
    const tx = await this.findReceive(invoice.walletId, invoice.paymentHash);
    if (!tx) return { state: "UNKNOWN" };
    return {
      state: tx.status === "SUCCESS" ? "PAID" : "PENDING",
      paidAmount: String(Math.abs(tx.settlementAmount)),
      walletId: invoice.walletId,
      paidAt: new Date(tx.createdAt * 1000).toISOString(),
      proofRef: `flash:tx:${tx.id}`,
    };
  }

  private async *walk(walletId: string, maxPages = 5) {
    let after: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const page = await this.listTransactions(walletId, after);
      for (const t of page.transactions as TxNode[]) yield t;
      if (!page.nextCursor) return;
      after = page.nextCursor;
    }
  }

  private async findReceive(walletId: string, paymentHash: string): Promise<TxNode | null> {
    for await (const t of this.walk(walletId)) {
      if (t.direction === "RECEIVE" && t.initiationVia?.paymentHash === paymentHash) return t;
    }
    return null;
  }

  async watchInvoice(
    invoice: { paymentHash: string; bolt11: string; walletId: string },
    onUpdate: (s: PaymentState) => void,
  ): Promise<() => void> {
    // FLASH_WS_URL is unconfirmed; do not guess a subscription endpoint. Poll + 30s reconciler instead.
    let last: PaymentState | null = null;
    const timer = setInterval(async () => {
      try {
        const s = (await this.getInvoiceStatus(invoice)).state;
        if (s !== last) {
          last = s;
          onUpdate(s);
        }
      } catch {
        /* reconciler will retry */
      }
    }, 3000);
    return () => clearInterval(timer);
  }

  async payInternal(input: {
    sourceWalletId: string;
    destinationWalletId: string;
    asset: Asset;
    amount: string;
    requestId: string;
    memo: string;
  }): Promise<SendResult> {
    const isBtc = input.asset === "BTC_SAT";
    const d = await this.gql<Record<string, { status: string; errors: GqlError[] }>>(
      isBtc ? Q.intraLedgerBtc : Q.intraLedgerUsd,
      {
        input: {
          walletId: input.sourceWalletId,
          recipientWalletId: input.destinationWalletId,
          amount: Number(input.amount),
          memo: `${input.memo} [${input.requestId}]`,
        },
      },
      { movesMoney: true },
    );
    const payload = d[isBtc ? "intraLedgerPaymentSend" : "intraLedgerUsdPaymentSend"];
    if (payload.errors?.length && payload.status !== "SUCCESS") {
      throw new ProviderRejectedError(`Payout rejected: ${sanitize(payload.errors[0].message)}`, false);
    }
    // Look up the resulting transaction so we persist a real provider id and measured fee.
    const found = await this.findPaymentByRequestId({
      sourceWalletId: input.sourceWalletId,
      requestId: input.requestId,
      since: new Date(Date.now() - 3600_000).toISOString(),
    });
    return {
      providerPaymentId: found?.providerPaymentId ?? `flash:intraledger:${input.requestId}`,
      status: sendStatus(payload.status),
      fee: found?.fee ?? "0",
    };
  }

  async payInvoice(input: { sourceWalletId: string; bolt11: string; requestId: string; maxFee: string }): Promise<SendResult> {
    const probe = await this.gql<{ lnInvoiceFeeProbe: { amount: number; errors: GqlError[] } }>(Q.feeProbe, {
      input: { walletId: input.sourceWalletId, paymentRequest: input.bolt11 },
    });
    if (BigInt(probe.lnInvoiceFeeProbe.amount ?? 0) > BigInt(input.maxFee)) {
      throw new ProviderRejectedError("Routing fee above cap", false);
    }
    const d = await this.gql<{ lnInvoicePaymentSend: { status: string; errors: GqlError[] } }>(
      Q.lnPay,
      { input: { walletId: input.sourceWalletId, paymentRequest: input.bolt11, memo: `[${input.requestId}]` } },
      { movesMoney: true },
    );
    const p = d.lnInvoicePaymentSend;
    if (p.errors?.length && p.status !== "SUCCESS") {
      throw new ProviderRejectedError(`Payment rejected: ${sanitize(p.errors[0].message)}`, false);
    }
    return { providerPaymentId: `flash:ln:${input.requestId}`, status: sendStatus(p.status), fee: String(probe.lnInvoiceFeeProbe.amount ?? 0) };
  }

  async findPaymentByRequestId(input: { sourceWalletId: string; requestId: string; since: string }): Promise<FoundPayment | null> {
    const sinceSec = new Date(input.since).getTime() / 1000;
    for await (const t of this.walk(input.sourceWalletId)) {
      if (t.createdAt < sinceSec - 300) break;
      if (t.direction === "SEND" && t.memo?.includes(`[${input.requestId}]`)) {
        return {
          providerPaymentId: `flash:tx:${t.id}`,
          status: t.status === "SUCCESS" ? "SUCCEEDED" : t.status === "PENDING" ? "PENDING" : "FAILED",
          amount: String(Math.abs(t.settlementAmount)),
          fee: String(Math.abs(t.settlementFee ?? 0)),
          destinationWalletId: t.initiationVia?.counterPartyWalletId,
        };
      }
    }
    return null;
  }

  async listTransactions(walletId: string, cursor?: string) {
    type Conn = {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      edges: { cursor: string; node: TxNode }[];
    };
    const d = await this.gql<{ me: { defaultAccount: { transactions: Conn } } }>(Q.transactions, {
      first: 50,
      after: cursor ?? null,
      walletIds: [walletId],
    });
    const conn = d.me.defaultAccount.transactions;
    return {
      transactions: conn.edges.map((e) => e.node),
      nextCursor: conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : undefined,
    };
  }

  async resolveDestination(input: { reference: string; asset: Asset }) {
    const walletCurrency = input.asset === "BTC_SAT" ? "BTC" : "USD";
    const ref = input.reference.trim();
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(ref)) throw new ProviderRejectedError("Enter a Flash username", false);
    const d = await this.gql<{ accountDefaultWallet: { id: string; walletCurrency: string } | null }>(Q.defaultWallet, {
      username: ref,
      walletCurrency,
    });
    const w = d.accountDefaultWallet;
    if (!w) throw new ProviderRejectedError("Flash user not found", false);
    if (w.walletCurrency !== walletCurrency) {
      throw new ProviderRejectedError(`Flash user has no ${walletCurrency} wallet`, false);
    }
    return { walletId: w.id, asset: input.asset, label: `@${ref} (Flash ${walletCurrency})` };
  }

  async getBalance(walletId: string): Promise<string> {
    const w = (await this.listWallets()).find((x) => x.id === walletId);
    if (!w) throw new ProviderRejectedError("Wallet not on this account", false);
    return String(w.balance);
  }
}

function sanitize(msg: string | undefined): string {
  return (msg ?? "unknown").replace(/fk_[A-Za-z0-9_-]+/g, "fk_[redacted]").slice(0, 200);
}
