# Chama on Lightning Cursor Coding Brief

Prepared for Immaculate Munde. Verified 6 November 2026, Africa/Nairobi (EAT, UTC+3).

Implementation source of truth for a complete mobile-web hackathon build. Figma owns visual appearance. This brief owns behavior, money correctness, security and acceptance criteria. Build a functioning product, not a clickable slideshow. Use test funds until custody, operational and legal review are complete.

## 1. How to use this brief in Cursor

1. Put this file at the repository root as `chama-on-lightning-cursor-brief.md` and ask Cursor to read it completely.
2. Connect Figma MCP using an account with view access to the file. The URL/file key does not grant permission. Request access from the owner if needed; never commit Figma credentials.
3. Open the file by fileKey `eTSzwsezboz0KoVJrbifAI`. Inspect both pages, then every screen node in section 2. Implement pixel-faithfully from those frames, mobile-first at 390x844.
4. In a standard Cursor Figma MCP with explicit node targeting, use `get_design_context` / `get_screenshot` on each node-id when coding UI. Pass the file key where required; tool parameter casing varies. Do not rely on a current selection. If that connector cannot use `get_design_context` without a selection, use `get_metadata` plus read-only `use_figma` queries and screenshots instead. Verification for this brief used `create_session` and read-only `use_figma`, never `get_design_context`.
5. Export original wing + coin logo and receipt illustration from Figma. Store permitted assets under `public/brand/`, with source node and ownership notes. Do not substitute emoji, hotlink temporary MCP asset URLs or scrape credentials.
6. Build payment spike and schema first, then domain engine, all screens, receipts, diaspora slice and tests. Keep demo simulation visibly separate from actual Flash test settlement.
7. Deliver migrations, seeds, `.env.example`, README, worker/deployment instructions, tests and a checklist distinguishing implemented, simulated and blocked functionality.

Suggested Cursor prompt:

> Read chama-on-lightning-cursor-brief.md completely. Inspect Figma fileKey eTSzwsezboz0KoVJrbifAI and all listed screen nodes through MCP. Plan and implement the entire Next.js TypeScript mobile PWA with a server-only Flash adapter, durable ledger and automatic payout worker. Match the 390x844 frames. Never infer paid status from a click. Label simulation clearly. Include migrations, seeds, tests, setup and deployment. Configure secrets only through ignored local/deployment environment variables.

Fixed decisions: rotating savings, not lending or investing; fully funded automatic payout only; all ten screens in scope; BTC and Flash USD-stable modes; actual provider settlement is financial truth. Prefer a single settlement asset per group cycle. Never silently combine BTC and USD balances.

## 2. Figma access

- Design file: https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning
- File key: eTSzwsezboz0KoVJrbifAI
- Prototype: https://www.figma.com/proto/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=2-2&starting-point-node-id=2-2
- Flow starting point: "Chama demo" on Splash, node id 2:2 (URL form 2-2)
- Pages: `Cover / Design Library` (page node `0:1`), and `Screens` (page node `1:24`).

Every top-level frame below was confirmed directly from Figma on 6 November 2026. All ten measure 390x844. The actual page's flowStartingPoints confirmed the name `Chama demo` and node `2:2`.

| Exact screen frame name | Node id | Per-frame Figma URL |
| --- | --- | --- |
| 01 Splash | 2:2 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=2-2 |
| 02 Welcome | 2:19 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=2-19 |
| 03 Home - My Chamas | 3:2 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=3-2 |
| 04 Create Chama | 3:62 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=3-62 |
| 05 Group Dashboard - Ledger | 3:113 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=3-113 |
| 06 Contribute - Lightning QR | 5:2 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=5-2 |
| 07 Payment Success | 5:237 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=5-237 |
| 08 Payout - Automatic | 5:267 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=5-267 |
| 09 Diaspora Contribute - UK | 5:326 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=5-326 |
| 10 Receipt | 5:378 | https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=5-378 |

Read actual sizes, typography, line heights, shadows, corner radii, bounds and nested assets rather than inventing a new design system. Figma's `9:41`, `5G 100%` status bar is presentation chrome, not live telemetry. Include it only in screenshot/demo-shell mode; normal PWA respects real browser/OS chrome. Record intentional visual-test differences.

## 3. Product and demo script

A chama is a rotating savings circle. Members agree contribution amount, cadence and payout order. Members pay via Lightning invoice, see a shared ledger, and the completed pot automatically goes to the next member. Users can hold/receive Bitcoin or Flash USD-stable value. Target women-led groups and diaspora relatives. Research targets 5 to 20 members; demo uses three.

Promise: "Three women, one pot, no notebook." Automation does not remove custody/operator risk. Flash is custodial and an operator with payment credentials controls funds. Say "automates the agreed payout", not "nobody can ever take the money".

### Canonical sample

| Field | Value |
| --- | --- |
| Group | Umoja Women Chama |
| Members | Amina Otieno, Wanjiku, Faith |
| Contribution | KES 5,000 each, weekly |
| Pot | KES 15,000 |
| Rotation | Wanjiku, Faith, Amina |
| Logged-in member | Amina Otieno |
| First destination | Wanjiku's verified test Flash BTC wallet |
| Alternative | Flash USD-stable wallet |
| Diaspora payer | Njeri in London, £30 -> KES 5,000 equivalent |
| Secondary Home card | Mama Mboga Savers, 8 members, KES 2,000 monthly |

Seed two scenarios: `fresh` (all unpaid) for the official demo; `last-payment` (Wanjiku and Faith paid, Amina pending) for UI review. Do not seed false settlements into an actual provider ledger. A second illustrative Home card must be labelled demo-only unless fully backed by records.

### Three-minute official demo

1. Splash/Welcome: explain a real savings-circle problem without unsupported statistics.
2. Create Umoja with three members, KES 5,000 weekly and Wanjiku -> Faith -> Amina order. Show invite code/link and selected asset.
3. Use three member sessions and funded permitted test wallets. Each pays a real Lightning invoice. Ledger ticks 0/3 -> 1/3 -> 2/3 -> 3/3.
4. Third verified settlement enqueues one automatic payout. Show processing, then sent only after provider confirmation. Show Wanjiku's receiving transaction/balance.
5. Open contribution receipt and distinct payout receipt, then share/download the branded ticket.
6. Open diaspora slice: Njeri covers an existing member obligation, with payer attribution, FX quote and historical fee comparison. If any leg is simulated, clearly label it in UI and presentation.
7. Close with Flash calls used, public repo, custody limitations and self-custody roadmap. Keep a recorded backup.

The KES-sized storyboard may use labelled demo FX or safely scaled test units. Never risk real KES 15,000 merely to match a mockup.

## 4. User flows / prototype map

These are required interaction contracts supplied for the prototype. Individual Figma connector destinations were not all independently inspected.

| From | Trigger | Destination | Runtime requirement |
| --- | --- | --- | --- |
| Splash | Timeout/tap | Welcome | Cancel timer on unmount; navigate once |
| Welcome | Get started | Home | Explicit demo session or auth |
| Welcome | Invite code | Ledger | Validate code, authenticate/join seat |
| Home | Chama card | Ledger | Use selected group id |
| Home | + Create | Create Chama | Persist actual group rules |
| Home | Total saved card | Diaspora | Carry group context |
| Create | Create and invite members | Ledger | Return created group and invite |
| Ledger | Contribute or Amina pending | Contribute QR | Create/reuse current obligation invoice |
| Contribute QR | Pay / QR / copy invoice flow | Payment Success | Only verified settlement navigates; copying alone never pays |
| Payment Success | See payout | Payout | Processing state until confirmed |
| Payment Success | Back to chama | Ledger | Refetch canonical state |
| Payout | View receipt | Receipt | Payout-specific receipt and total |
| Diaspora | Pay £30 | Receipt | Actual settlement or labelled simulation |
| Receipt | Share/Download | Home | Export first; cancel/failure stays on receipt |

Suggested routes:

```text
/                                      Splash
/welcome                               Welcome
/home                                  Home
/chamas/new                            Create
/join/[code]                           Join then Ledger
/chamas/[groupId]                       Ledger
/chamas/[groupId]/contribute            QR
/payments/[invoiceId]/success           Success
/chamas/[groupId]/payouts/[payoutId]     Payout
/chamas/[groupId]/diaspora               Diaspora
/receipts/[receiptId]                   Receipt
```

Reloads and direct links restore persisted state. Authenticate and authorize before revealing group/payment/receipt details. Back navigation must not create invoices or resend funds. Add consistent auth, invite entry, roster editor, error and confirmation modals even without dedicated top-level frames.

## 5. Visual system

| Token | Hex | Usage |
| --- | --- | --- |
| white | #FFFFFF | Clean surfaces |
| soft paper | #F7FAF8 | Background |
| sage wash | #E7F3EC | Soft highlights |
| money green | #0F6B4C | Primary actions, settled states |
| deep forest | #0A3D2E | Strong contrast, receipt |
| Bitcoin orange | #F7931A | Bitcoin/coin accent |
| warm orange | #FF9F1C | Warm accent |
| ink | #14201B | Primary text |
| muted | #5C6B64 | Secondary text |

Typography: Plus Jakarta Sans, optimized/local loading with system sans-serif fallback. Pill buttons, soft rounded cards, generous whitespace, avatar circles and calm green-led hierarchy. Match actual Figma type sizes/weights/spacing. Mobile-first 390x844; larger screens use a centered mobile column rather than stretched cards.

Shared components: `AppShell`, `PillButton`, `AmountDisplay`, `ChamaCard`, `MemberAvatar`, `LedgerRow`, `ProgressPot`, `CurrencyChoice`, `InvoiceQr`, `PaymentStatus`, `RotationList`, `FeeComparison`, `ReceiptTicket`, `DemoModeBanner`, accessible dialogs/toasts.

Receipt is a scalloped stamp ticket in deep forest with cream line drawing of three women around a basket and an orange Lightning coin, "asante sana!" and TOTAL: KES 5,000. Preserve original contribution fixture/artwork. Read cream color from asset. Use SVG/clip paths for scallops; do not replace with a generic white invoice. Other receipt types retain artwork but show their own actual totals, e.g. KES 15,000 payout.

Accessibility and PWA:

- Functional at 320px width and 200% zoom; `min-height: 100dvh`, safe-area padding, scrollable content and keyboard-safe actions. Do not hard-clip content to 844px.
- 44px minimum targets, semantic controls/headings, visible keyboard focus, labelled fields, sufficient contrast, text labels for paid/pending and reduced-motion support.
- Polite live regions for settlement changes. QR has text/clipboard alternative. Never repeat success announcements for duplicate events.
- Styled loading, empty, offline, unauthorized, expiry, provider failure and payout failure states.
- Manifest/icons/install support; cache static assets only. Never cache authenticated API/ledger/invoice data in a shared service worker cache. Offline is visibly stale/read-only; payments require connectivity.

## 6. Architecture and tech stack

### Stack

Next.js App Router, TypeScript, Tailwind CSS; optional shadcn/ui primitives styled to Figma; `qrcode.react`, `graphql-request`, `graphql-ws`, Zod, exact money math, Vitest and Playwright. Research recommends Next.js 14: choose a currently supported stable release when scaffolding, pin versions and commit lockfile rather than blindly using an old major.

Primary DB: Postgres, optionally Supabase Postgres/Auth/Realtime as in research. Lightweight local option: SQLite with transactions and one durable worker, portable ORM such as Prisma or Drizzle. SQLite needs persistent disk; never deploy it on ephemeral serverless storage. Prefer Postgres for concurrent workers. Do not implement two database engines unless both are tested.

Backend: Next.js route handlers with server-only domain/payment services, plus a persistent Node worker. A small Fastify API is an acceptable alternative. Deploy web to Vercel/Node, DB to managed Postgres, worker to a persistent service. Supabase cron can trigger reconciliation; permanent WebSockets/interval loops must not run inside short-lived request handlers. Durable jobs, leases and checkpoints live in DB.

```text
PWA -> authenticated API -> domain services -> durable ledger/database
                              |                    | outbox
                              v                    v
                         PaymentsProvider <-> Flash test GraphQL
                              ^
                    watcher + reconciler + payout worker
                              |
                      DB commit -> realtime/SSE -> PWA
```

Repository:

```text
app/                       routes and pages
components/                shared Figma-styled primitives
features/chamas/           creation, membership, rotation, ledger
features/payments/         invoice/payment UI
features/receipts/         ticket and export
lib/auth/                  session and membership checks
lib/db/                    schema, migrations, transactions
lib/money/                 exact conversion and formatting
lib/payments/              provider.ts, flash.ts, demo.ts
lib/domain/                contribution and cycle state machines
worker/                    watchers, reconciler, outbox processor
i18n/                      English and Swahili catalogs
public/brand/              original exported assets
scripts/                   seed, Flash smoke test, reconciliation
tests/                     unit, integration, fixtures, Playwright
```

### Provider interface

This is an application contract, not literal Flash signatures. Implement current verified GraphQL operations inside `flash.ts`, never directly in React.

```ts
type Asset = 'BTC_SAT' | 'USD_CENT';
type PaymentState = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'UNKNOWN';
interface PaymentsProvider {
  createInvoice(input: {
    walletId: string; asset: Asset; amount: string; memo: string;
    expiresInSeconds: number; requestId: string;
  }): Promise<{
    providerId: string; paymentHash: string; bolt11: string;
    expiresAt: string; amount: string; asset: Asset;
  }>;
  getInvoiceStatus(paymentHash: string): Promise<PaymentState>;
  watchInvoice(paymentHash: string,
    onUpdate: (s: PaymentState) => void): Promise<() => void>;
  payInternal(input: {
    sourceWalletId: string; destinationWalletId: string;
    asset: Asset; amount: string; requestId: string;
  }): Promise<{ providerPaymentId: string; status: string; fee: string }>;
  payInvoice(input: {
    sourceWalletId: string; bolt11: string; requestId: string; maxFee: string;
  }): Promise<{ providerPaymentId: string; status: string; fee: string }>;
  listTransactions(walletId: string, cursor?: string): Promise<{
    transactions: unknown[]; nextCursor?: string;
  }>;
}
```

Amounts cross JSON boundaries as validated integer decimal strings. Use BigInt/exact decimal internally. Distinguish invoice ID, Lightning hash and outgoing transaction ID.

### API contract

Require valid session, active membership and role checks. Validate with Zod. Return structured errors `{error:{code,message,retryable},requestId}`. Mutations use idempotency keys and CSRF/origin protection when cookie-authenticated.

| Method/path | Responsibility |
| --- | --- |
| POST /api/chamas | Validate rules/roster/order, create group/cycle/obligations/invite atomically |
| POST /api/invites/accept | Validate token/expiry/seat, bind authenticated user, return group |
| GET /api/chamas | List only groups visible to user |
| GET /api/chamas/:id/ledger | Round, obligations, funded total, payout state, activity cursor |
| POST /api/chamas/:id/invoices | Current obligation, quote and asset; reuse valid open invoice |
| GET /api/invoices/:id | Canonical state, expiry and safe details after ownership check |
| POST /api/invoices/:id/pay | Optional authorized member-wallet payment, never fake settlement |
| GET /api/chamas/:id/events | Authorized SSE or Supabase Realtime updates |
| GET /api/payouts/:id | Canonical payout status and rotation |
| POST /api/chamas/:id/diaspora-invoices | Existing obligation plus separate payer attribution |
| GET /api/receipts/:id | Authorized immutable receipt snapshot |
| GET /api/receipts/:id/pdf | Authorized private PDF download |

Rate-limit auth, invites, invoice creation and outbound payments. No public endpoint may impersonate a provider settlement event. Protect internal job triggers separately.

### Financial state engine

1. Freeze cycle roster, recipient, settlement asset, contribution units and rules. Verify recipient destination before collecting funds. Lock rules after first paid contribution.
2. Generate obligations and quote snapshots. KES is display denomination; settlement is sats or USD cents. Freeze cycle-level settlement targets, store invoice FX source/time/expiry, round deterministically so obligation units sum exactly to pot target. Explain that later KES equivalent may vary; do not guarantee KES redemption.
3. Create/reuse invoice through server adapter. Recover uncertain invoice creation by reconciliation rather than blindly duplicating. Retain old invoices if regenerated.
4. Watch provider on server. Verify hash, destination wallet, asset, amount and final status. QR scans, clipboard actions and button clicks are not payment evidence.
5. In one DB transaction deduplicate event/transaction, lock cycle, record settled amount, mark obligation paid, append audit event and insert uniquely keyed payout intent when all obligations are complete.
6. Separate worker leases intent; validates full funding, recipient, balance, fee reserve and asset; sends payout; persists provider result. Rotation advances only after confirmed success.
7. A timeout after send becomes `UNKNOWN`. Reconcile provider transaction history before resending. Unique database rows alone cannot guarantee exactly-once external transfer. Use tested provider idempotency if available. If safe lookup is unavailable, stop for operator review, never blind retry.
8. Retry only definitely-unsent retryable failures, with bounded backoff. Subscription reconnect plus 30-second paginated reconciliation catches missed events. Resume open invoices/jobs on restart.
9. Create immutable receipt snapshots from settled records. Payout failure must not undo contributions. Never advance rotation on queued/failed/unknown payout.

Use one settlement asset per cycle for MVP. Save member BTC/USD preference, but actual cross-asset payout requires verified conversion support, explicit quote, fees and consent. If conversion is not implemented, restrict payout to funded asset and explain that alternate preference is unavailable for this cycle. Do not silently treat sats and cents as equal or assume conversions free.

Fees: never silently shrink a promised pot. Pre-fund a separate test fee reserve, use verified free internal transfers, or disclose agreed net payout before collecting. Track contribution principal, payout, fees and reserve separately. Reconcile provider balance against all allocated group liabilities, not Home lifetime-savings totals. Example KES 0.40 fee is illustrative unless measured.

### Security and operations

Application auth is separate from Flash operator login. Use Supabase Auth OTP/magic link or equivalent secure sessions; members never receive operator keys. Membership/role checks on every endpoint. If using Supabase, enable RLS for client-accessible tables and scope by `auth.uid()` membership. Service-role key remains server-only; privileged services still check membership.

Prefer mentor-provisioned per-group test accounts; otherwise isolate allocations explicitly and disclose shared custodial-account risk. Do not invent unsupported wallet-creation features. Freeze verified payout destination per cycle; changes require explicit confirmation and affect future cycles.

TLS, secure cookies, amount caps, least-privilege Flash scopes, redacted logs and no private data in fixtures. Monitor worker heartbeat, reconciliation lag, subscription failures, unknown payouts, duplicate events and balance mismatches. Add `/api/health` without exposing credentials.

Hash chaining is tamper-evident relative to a trusted checkpoint, not tamper-proof against a database administrator who rewrites the whole chain. Export/checkpoint hashes periodically and describe limitation honestly. Production Kenyan fund pooling needs legal/licensed-partner analysis; this test build is not authorization to accept deposits.

## 7. Data models

UUID IDs, foreign keys, migrations and timestamps. Store instants in UTC, render in Africa/Nairobi (EAT); use London time only with explicit label. Integer money plus asset tag; no floating-point balances. Secrets never go in ordinary member/group records.

| Model | Fields and constraints |
| --- | --- |
| Group | id, name, ownerUserId, displayCurrency=KES, contributionKesMinor, settlementAsset, frequency=WEEKLY/MONTHLY/CUSTOM, customIntervalDays?, timezone=Africa/Nairobi, payoutPolicy=ALL_PAID, status, rulesVersion, providerAccountRef; positive amount and valid interval |
| Member | id, groupId, userId?, displayName, role=OWNER/MEMBER, inviteState, rotationPosition, payoutPreference=BTC/USD, destinationType, verifiedDestinationRef, destinationVerifiedAt; unique(groupId,userId) when bound, unique(groupId,rotationPosition) |
| Cycle | id, groupId, roundNumber, rosterSnapshot, recipientMemberId, settlementAsset, targetSettlementUnits, displayTargetKesMinor, opensAt, dueAt, status=OPEN/FUNDED/PAYOUT_PENDING/PAID_OUT; unique(groupId,roundNumber) |
| Contribution | id, cycleId, memberId, payerUserId?, payerLabel?, dueKesMinor, dueSettlementUnits, settledSettlementUnits, status=PENDING/PAID/LATE, paidAt?, winningInvoiceId?; unique(cycleId,memberId) |
| Invoice | id, contributionId, provider, providerInvoiceId?, paymentHash, bolt11, asset, amountUnits, quoteId, status=CREATING/PENDING/PAID/EXPIRED/FAILED/UNKNOWN, expiresAt, paidAt?, createRequestId; unique(provider,paymentHash), unique(createRequestId) |
| Payout | id, cycleId, recipientMemberId, destinationSnapshot, sourceWalletRef, asset, principalUnits, feeUnits, feeAsset, status=QUEUED/PROCESSING/SUCCEEDED/FAILED/UNKNOWN, providerPaymentId?, requestId, attempts, leaseUntil?, lastError?, sentAt?; unique(cycleId), unique(requestId) |
| Receipt | id, receiptNumber, kind=CONTRIBUTION/PAYOUT/DIASPORA, contributionId?, payoutId?, payerName, recipientName?, groupName, roundNumber, moneySnapshot, feeSnapshot, fxSnapshot, providerProofRef, settledAt, snapshotJson, contentHash; immutable, unique source/kind |
| FxQuote | id, baseCurrency, quoteCurrency, rateDecimal, source, fetchedAt, validUntil, mode=LIVE/DEMO, roundingRule; exact decimal rate |
| LedgerEvent | id, groupId, cycleId?, sequence, type, canonicalPayload, previousHash, eventHash, occurredAt, actorRef; unique(groupId,sequence), append-only |
| ProviderEvent | id, provider, providerEventId or deterministic dedupeKey, paymentHash?, payloadDigest, receivedAt, processedAt; unique(provider,dedupeKey) |
| Job/Outbox | id, type, aggregateId, dedupeKey, status, availableAt, leaseOwner?, leaseUntil?, attempts; unique(dedupeKey) |
| Invite | id, groupId, invitedMemberId?, tokenHash, expiresAt, maxUses, uses, revokedAt?; store hash, not redeemable token |

Rules:

- One obligation per member per cycle. Multiple invoice attempts retained. An expired invoice may settle late; reconcile it and prevent duplicate credit/payout. Underpayments remain unresolved. Overpayments are a separately tracked liability needing explicit refund/credit policy, not free group money.
- Append compensating audit events for corrections, with actor/reason; do not silently edit settled history.
- Funding check and unique payout intent happen in a locked/serializable DB transaction. Concurrent final payments cannot create two jobs.
- Receipt stores actual principal/fee units, display FX/source/date, environment/network and proof reference. Short hash in UI, authorized full proof on request.
- Njeri pays for an outstanding member obligation or future round. Do not add a fourth contribution to an already completed three-person pot. Separate payer from beneficiary.

### Figma fixture arithmetic and corrections

Figma uses KES 5,000 = 3,220 sats at 0.644 sats/KES; full pot is 9,660 sats. Keep these only in labelled `DEMO` fixtures, not a market-rate feed. Home's KES 48,500, 31,240 sats and $375.40 are illustrative lifetime statistics, not a coherent rate to reuse. Live totals derive from persisted history and quote snapshots.

The shortened invoice `lnbc32200n1pj9chama...q7x4` is artwork, not a valid BOLT11 invoice. Never encode it into a real QR. Generate actual provider test payment requests and label their network.

Prototype labels are inconsistent: Home says 1/3 paid while Ledger displays KES 10,000/15,000. Last-payment runtime fixture must consistently be 2/3 paid, Amina pending, Wanjiku/Faith paid. Preserve appearance but fix semantic paid/pending badges rather than reproducing contradictory text.

## 8. Feature breakdown MVP vs stretch

### MVP required

- All ten screens plus auth, invite, roster editor and styled error states.
- Group creation, amount/cadence/currency rules, member roster, manual rotation, verified destinations and invites.
- English/Swahili message catalogs and persisted locale, matching research.
- BTC and Flash USD-stable group modes separately tested; saved member preferences with honest conversion restrictions.
- Valid BOLT11 QR, clipboard/deep link, expiry/regeneration, real settlement status.
- Shared paid/pending/late ledger, pot progress, round history and append-only audit log.
- Persistent watcher, reconciler, automatic fully funded payout, safe retry/unknown handling.
- Accurate branded contribution/payout/diaspora receipts, sharing and PDF export.
- Diaspora UK contribution and fee comparison are an intended included slice, even though older research categorizes it as stretch. Any missing GBP on-ramp/KES off-ramp/FX leg must be prominently disclosed, not implied working.
- PWA shell, offline read-only behavior, test/demo fixtures, deployment, tests, README and backup recording.

### Stretch after core works

Telegram/WhatsApp notifications, reputation/proof-of-savings statements, random draw, grace/late fee rules, emergency votes, non-rotating goals, loans, USSD, LNbits/Breez fallback and self-custody withdrawal. Omit or explicitly disable unimplemented controls. A demo provider is not an implemented LNbits integration.

### Diaspora comparison logic

Research quotes historical World Bank UK-Kenya 2025 costs of 3.43% to 4.44%; design rounds to 3.4% to 4.4%. Display historical/source caveat, not a live provider quote. Add the exact verified corridor report/table before public comparative claims; this brief has not independently rechecked the World Bank table.

For £30: `30 * 0.034 = £1.02`, `30 * 0.044 = £1.32`. Savings equals historical estimated traditional fee minus complete measured Lightning path cost, including available wallet/on-ramp/FX/off-ramp charges. If some costs are unknown, label "Lightning network fee only; other provider/FX costs may apply" and do not claim end-to-end savings.

Figma's "under 0.1%", "A few pence", "settles in seconds" and "saves about £1.20" are placeholders, not promises. Under 0.1% of £30 means under £0.03. Use actual measured cost/timing or label assumptions. Free Flash-internal transfer is different from external Lightning routing and fiat conversion costs.

£30 -> KES 5,000 implies approximately 166.6667 KES/GBP, illustrative unless actively quoted. Flash Lightning is not GBP card checkout, and KES-equivalent credit is not Kenyan bank/M-Pesa cash-out. No GBP on-ramp, M-Pesa integration or guaranteed KES withdrawal is included in this MVP. Make unavailable legs clear in UI, README and presentation.

## 9. Flash API notes

### Confirmed in research, not executed here

The research's `Flash API Primer` explicitly lists:

- Test GraphQL: https://api.test.flashapp.me/graphql
- Production GraphQL: https://api.flashapp.me/graphql
- Docs: https://docs.flashapp.me/
- API keys: https://docs.flashapp.me/guides/api-keys
- Phone login: `userPhoneRegistrationInitiate(phone)` then `userLogin(phone, code)`, JWT described as valid seven days. Header: `Authorization: Bearer <token>`.
- Backend key: `apiKeyCreate` after user session, format `fk_...`; header `X-API-KEY`.
- Described scopes: read_user, write_user, read_wallet, write_wallet, read_transactions, write_transactions, admin. Choose least privilege, not blanket admin.
- Key rate-limit error may include `TOO_MANY_REQUESTS` and `retryAfterSeconds`.

Test endpoint is confirmed as stated in existing research, not independently confirmed operational. Before coding actual operations, inspect official docs/current schema, save schema snapshot and generate typed GraphQL documents. Confirm units, test network/funding, auth, current expiry behavior, subscription URL/protocol and payout idempotency with mentors.

| Need | Research operation | Check |
| --- | --- | --- |
| Wallet IDs and balances | `me { defaultAccount { wallets { id walletCurrency balance } } }` | Correct wallet/asset and units |
| BTC invoice | `lnInvoiceCreate` | sats, walletId, memo, expiry, payment request/hash |
| USD-stable invoice | `lnUsdInvoiceCreate` | Research says cents and short FX-lock expiry; confirm |
| Live payment | `lnInvoicePaymentStatus`, `myUpdates` | Server subscriptions and reconciliation |
| Internal BTC payout | `intraLedgerPaymentSend` | Verified destination, free-fee claim and amount semantics |
| Internal USD payout | `intraLedgerUsdPaymentSend` | Supported wallet combination and units |
| External payout | `lnInvoiceFeeProbe`, `lnInvoicePaymentSend` | Fee cap, expiry, unknown-outcome recovery |
| Reconciliation | `me.defaultAccount.wallets.transactions` | Pagination, overlap windows, dedupe, final status |
| Price | `realtimePrice(currency: "USD")` | Response units; separate FX feed if KES/GBP unsupported |

Research example shape, for schema verification only:

```graphql
mutation {
  lnInvoiceCreate(input: {
    walletId: "WALLET_ID"
    amount: 2100
    memo: "Chama contribution"
  }) {
    invoice { paymentRequest paymentHash satoshis }
    errors { message }
  }
}
```

GraphQL HTTP 200 may contain errors. Handle transport, top-level GraphQL and operation payload errors. Use variables, typed documents and sanitized error logging. Do not guess WebSocket URL or assume developer webhooks exist. Research recommends subscriptions plus a 30-second transaction reconciler.

Flash is Caribbean-focused; Kenyan +254 registration may not work. Ask Flash mentors for test credentials/funding early. Lack of access is a dependency, never permission to fabricate live integration. API is changing: pin tested schema and keep thin adapter. USD-stable is custodial Flash value, not native USDT, bank deposit insurance or a KES bank account.

Core demo uses verified internal recipient wallet. Lightning address payouts require supported address-to-invoice resolution and SSRF-safe fetches; treat as stretch unless fully implemented/tested. A fallback provider must be explicit. Never silently swap a failed Flash request to simulation. Mark invoices, balances and receipts with environment/mode.

Flash spike acceptance:

1. Authenticate test account and list BTC/USD wallets.
2. Generate and pay one invoice in each asset from a second permitted test wallet.
3. Observe actual final status; restart watcher and prove reconciliation recovers missed payment.
4. Send one internal payout, record transaction ID/units/destination/measured fee.
5. Determine provider idempotency or safe timeout lookup; document stop-for-review if unavailable.
6. Save redacted fixtures and typed queries, never secrets or SMS codes.

## 10. Screen-by-screen implementation notes

### 01 Splash, 2:2

Wing + coin logo, "Chama", "on Lightning", "Save together. Paid out on time." Match composition. Advance on tap or configurable short delay, approximately 1.5 seconds. Cancel timer on unmount; reduced motion; no double navigation or auth bypass.

### 02 Welcome, 2:19

Three-member visual, "Your chama, now on Lightning" and original savings-circle explanation. Get started opens explicit demo Home or auth then Home. Invite code opens accessible modal, validates server-side, binds authenticated user to seat then Ledger. Handle invalid, expired, already-used and already-member. "Round 3 of 10" in onboarding artwork is not actual demo cycle state.

### 03 Home - My Chamas, 3:2

"Habari, Amina", avatar, active group count, Total saved, two group cards and Create CTA. Demo lifetime KES 48,500; Umoja weekly KES 5,000; Mama Mboga monthly KES 2,000. Real values derive from records, not direct addition of KES/sats/dollars. Card goes to selected group; Total saved opens Diaspora. Empty state allows create/join. Keep paid counts consistent with ledger, correcting conflicting prototype fixture values.

### 04 Create Chama, 3:62

Name, contribution, Weekly/Monthly/Custom, Bitcoin/USD-stable, payout order and Create/invite action. Defaults match canonical fixture. Edit opens add/remove/rename/reorder roster dialog with keyboard-accessible order controls. Validate positive supported amount, valid name/interval, at least three demo members, unique seats/order and verified destination. Freeze rules after collection begins. Save atomically, prevent duplicate submits and surface invite link/code on resulting Ledger. Rate conversion shown next to amount is live quote or labelled illustration.

### 05 Group Dashboard - Ledger, 3:113

Group header, Round 1 progress, "Payout to Wanjiku fires when all 3 have paid", shared ledger and rotation. Last-payment fixture: KES 10,000/15,000, Amina pending, Wanjiku and Faith paid. Correct misordered/inconsistent Paid/Pending labels in source; paid badges follow data. Amina row/Contribute creates/reuses her obligation invoice. Paid members see receipt/status, not another payable invoice. Live updates preserve order/scroll. Display real EAT timestamps, lateness, current payout status and history. Expose invitation details and member access controls without redesigning the core frame.

### 06 Contribute - Lightning QR, 5:2

Group/round, KES 5,000, quoted settlement amount/rate, amount chips, valid QR, full copyable invoice, expiry countdown and primary payment action. Other design denomination chips cannot silently change fixed obligation: disable/label unavailable amounts for MVP rather than accidentally accepting KES 2,500/7,500 against a KES 5,000 rule.

Server creates/reuses invoice with auth/member context. QR decodes to real provider BOLT11; clipboard copies complete value even if UI truncates. Copy feedback says "Invoice copied. Waiting for payment", never success. Support wallet deep link/network validation. Pay from Chama wallet requires an authorized member-owned source wallet; do not circularly pay from the recipient group wallet. If member wallet access unavailable, use external wallet primary action and explain. Navigate only after provider-confirmed paid event. Show expiry, reconnection, failure and safe regeneration; reconcile older invoice late payments.

### 07 Payment Success, 5:237

"Contribution received", actual settled amount/time, avatars and paid count. Full fixture is KES 5,000 / 3,220 sats / 3 of 3. "Settled in 2s" only if measured. If all paid, show payout processing until confirmed; if fewer paid, truthful waiting copy replaces design full-pot message. See payout opens persisted payout; Back to chama refetches ledger. Reload checks actual invoice paid status, not a client flag.

### 08 Payout - Automatic, 5:267

Status card, KES 15,000 to Wanjiku, actual settlement units, fee/date, rotation and View receipt. Distinct queued, processing, succeeded, failed, unknown states. Only confirmed success says "Automatic payout sent"/"Paid out". Unknown means reconcile, not a resend CTA. Rotation Wanjiku/Faith/Amina, trigger "When all members pay", verified destination. Fixture dates Fri 6, 13, 20 Nov 2026 are historical demo EAT dates. Compute schedule from persisted rules, not hardcoded unrelated "Sat 7 Nov". Weekly next cycle opens after prior successful payout and due date follows next weekly boundary. Payout receipt total is KES 15,000, not KES 5,000.

### 09 Diaspora Contribute - UK, 5:326

"Pay in from abroad", Njeri in London, Umoja, £30 and KES 5,000 equivalent with comparison cards. Include quote expiry/source or illustrative label, historical fee benchmark caveat and mode badge. Select existing member/round obligation, record actual payer separately. Pay £30 means quoted Lightning equivalent, not a GBP bank/card debit. Reuse QR/payment UI or modal, then diaspora receipt only after settlement. A simulated action must say simulated. No duplicate obligations or unexplained fourth contribution. Apply all material cost/FX/on-ramp/off-ramp caveats in section 8.

### 10 Receipt, 5:378

Original deep forest scalloped ticket with cream women/basket drawing, orange Lightning coin and "asante sana!". Contribution fixture: CHM-0001-R1-03; Umoja; Round 1; Amina Otieno; KES 5,000.00; 3,220 sats; illustrative rate 0.644; settled status; proof; TOTAL: KES 5,000. Payout/diaspora kinds use correct principal, payer/recipient and labels.

Immutable snapshot supplies every field. Design's KES 0.40 fee and abbreviated hash are not live data. "Bank transfer would cost KES 170 to 220" is a rough 3.4% to 4.4% historical remittance benchmark, not a domestic bank quote. Label its true scope or omit when inapplicable. Test/simulation receipts must be visibly marked.

Share uses Web Share API for an explicitly generated privacy-minimized file; fallback copy/download. PDF is a real branded ticket export, not blank page/raw JSON. Use controlled receipt renderer, embedded/available fonts, print CSS and readable exact totals; verify opening and no clipping. Optional PNG is an addition, not PDF replacement. Successful share/download returns Home per prototype. Cancel/failure stays on receipt with retry.

### Test acceptance

- Screenshots for all ten at 390x844 with deterministic fonts/fixtures; compare to Figma, document intentional mode/status-bar/truthful-state changes.
- Fresh scenario: three real test settlements produce exactly one payout and one payout receipt with matching recipient proof/balance.
- QR/copy/tap alone never pays; refresh/back navigation never repeats transfer.
- Duplicate/out-of-order events, two workers, simultaneous final contributions never double count/send.
- Crash after payout submission becomes UNKNOWN/reconciliation, never blind resend.
- Expiry, regeneration/late old invoice settlement, under/overpayment, provider timeout, rate-limit, restart and lost subscription covered.
- BTC/USD units, quote lock, rounding and receipt totals deterministic; pot includes principal/fee reserve accounting.
- Nonmembers/cross-group ID tampering cannot access ledger/invoice/receipt or replace destination.
- Diaspora payer attribution cannot credit same obligation twice; £30 benchmark math yields £1.02 to £1.32.
- PDF opens correctly with actual total/type; sharing contains no credentials/private unnecessary data.
- Keyboard/screen reader, reduced motion, 320px layout, mobile keyboard and read-only offline states tested.

## 11. Env vars

Commit names/placeholders only in `.env.example`. Actual secrets live in ignored `.env.local` or deployment secret storage. No secret gets `NEXT_PUBLIC_`. Never put tokens/SMS codes in logs/screenshots/fixtures/README/git history.

```dotenv
# Public non-secret configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Chama on Lightning
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_DEMO_MODE=true

# Server-only payments
PAYMENTS_PROVIDER=demo
FLASH_GRAPHQL_URL=https://api.test.flashapp.me/graphql
FLASH_WS_URL=CONFIRM_WITH_FLASH_DOCS
FLASH_API_KEY=SET_LOCALLY_ONLY
FLASH_BTC_WALLET_ID=SET_LOCALLY
FLASH_USD_WALLET_ID=SET_LOCALLY
FLASH_NETWORK=CONFIRM_WITH_MENTOR
PAYMENT_MAX_FEE_UNITS=SET_FOR_ASSET
PAYMENT_MAX_PRINCIPAL_UNITS=SET_FOR_TEST_ENVIRONMENT

# Server persistence/session/worker
DATABASE_URL=SET_DATABASE_CONNECTION
SESSION_SECRET=GENERATE_RANDOM_SECRET_LOCALLY
INTERNAL_WORKER_SECRET=GENERATE_RANDOM_SECRET_LOCALLY
RECEIPT_SIGNING_SECRET=GENERATE_RANDOM_SECRET_LOCALLY

# FX and monitoring
FX_PROVIDER=demo
FX_API_URL=SET_IF_LIVE_FX_SUPPORTED
FX_API_KEY=SET_IF_REQUIRED
RECONCILE_INTERVAL_SECONDS=30
ALLOW_SIMULATED_PAYMENTS=true

# Optional Supabase implementation
NEXT_PUBLIC_SUPABASE_URL=SET_IF_USING_SUPABASE
NEXT_PUBLIC_SUPABASE_ANON_KEY=PUBLIC_ANON_KEY_ONLY
SUPABASE_SERVICE_ROLE_KEY=SERVER_ONLY_IF_REQUIRED

# Stretch notifications
TELEGRAM_BOT_TOKEN=OPTIONAL_SERVER_ONLY
```

Startup config validation rejects placeholders in Flash mode, simulation in real-funds mode or mismatched public/server mode badge. Public demo flag is cosmetic; server authorizes simulation. Reset/simulation endpoints restricted to dedicated test/demo deployment and records. No silent Flash-to-demo fallback. If phone JWT used instead of API key, store server-side encrypted token and implement expiry/re-auth; do not require both auth modes. Remove unused env vars from final implementation.

Required working commands or documented equivalents:

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run db:seed -- --scenario fresh
npm run dev
npm run worker
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run test:e2e
npm run build
npm run flash:smoke
```

Smoke test uses permitted test credentials/caps and explicit confirmation for outbound payment, never moves production funds on install. Seed/reset refuses non-demo database/provider. README includes deployment, worker restarts, migration procedure, reconciliation and sanitized diagnostics.

## 12. Hackathon submission checklist and deadline

Sovereign Stack / Satoshi Sister Circle. Official site: https://sites.google.com/view/sschackathon

**Public GitHub repository plus README due 18 November 2026.** Reconfirmed directly on official rules page. Exact cutoff time/timezone is not stated; ask organisers instead of assuming midnight. Internal freeze 17 November 2026 EAT; publish early on 18 November EAT. Confirm Demo Day time and submission form. Flash API use qualifies for Flash Prize consideration according to research; confirm category details, do not promise an award.

| Dates, EAT | Delivery |
| --- | --- |
| 6 to 8 November 2026 | Credentials/spike, schema/migrations, design exports, initial screens |
| 9 to 11 November 2026 | Groups/invites, invoices, live ledger, durable worker/reconciliation |
| 12 to 14 November 2026 | Safe automatic payout, receipts/PDF, diaspora, locale/mobile polish |
| 15 to 16 November 2026 | Failure/security tests, deploy, rehearse |
| 17 November 2026 | Code freeze, README, secret scan, backup recording |
| 18 November 2026 | Verify public repo/README and submit per organiser guidance |

- [ ] Open source from day one, compatible license, preferably MIT with asset/dependency rights checked.
- [ ] README: problem/users/solution, screenshots, architecture diagram, exact versions/setup/env names/migrations/seed/tests/deployment, Flash operations, custody/FX assumptions, working features, mocks/limitations and roadmap.
- [ ] Meaningful Bitcoin integration demonstrated with real test invoice settlement and outgoing payout proof, not branding alone.
- [ ] Live demo URL, permitted funded test wallets, three-minute backup video.
- [ ] No secrets or personal data in files/history; run secret scanner such as gitleaks, enable secret scanning and rotate any exposed key.
- [ ] Acknowledge libraries, artwork, licenses, existing contributions and AI tools. If extending previous work identify significant hackathon-built feature.
- [ ] Honest demo, labelled simulation, no plagiarism or unsupported feature claims.
- [ ] Verify public repo logged out and fresh install from README; confirm organiser guidance and submission method.

Judging: real-world problem, technical execution, meaningful Bitcoin integration, impact/potential, open source/collaboration, presentation. Do not invent judging weights. A trustworthy complete payment loop beats extra fake features.

Definition of done: fresh clone runs in labelled demo mode without secrets. A separately configured Flash test deployment creates a group, accepts three verified contributions, updates shared ledger, safely sends exactly one automatic payout to correct recipient and produces accurate branded receipts. All ten screens and diaspora slice work, tests pass and another developer can reproduce from README. If Flash access is blocked, report it and ship honest labelled simulation/integration work without claiming live settlement.

## 13. Source links

### Design

- Design: https://www.figma.com/design/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning
- Prototype: https://www.figma.com/proto/eTSzwsezboz0KoVJrbifAI/Chama-on-Lightning?node-id=2-2&starting-point-node-id=2-2
- Directly verified through Figma MCP on 6 November 2026: pages, all ten frame names/IDs/dimensions, screen text and Chama demo starting point. No design edits made.

### Research and hackathon

- SSC Projects research: https://docs.google.com/document/d/1b7YdIFhn-CEyGtWj_uxgLkFX8fM1KKwHvKLZudIB4Zc/edit
- Tabs read directly: Overview; Hackathon Info (`t.z9ain7f33yzx`); Flash API Primer (`t.j2m8hsxaja4s`); 1 Chama on Lightning (`t.1k779cimppge`). Research dated 4 November 2026; read 6 November 2026.
- Hackathon: https://sites.google.com/view/sschackathon
- Rules, directly read 6 November 2026: https://sites.google.com/view/sschackathon/hackathon-rules
- Flash sponsor: https://sites.google.com/view/sschackathon/sponsors/flash

### Flash and costs

- Flash docs: https://docs.flashapp.me/
- API keys: https://docs.flashapp.me/guides/api-keys
- Flash source/schema starting point: https://github.com/lnflash/flash
- Test GraphQL explicitly recorded in research: https://api.test.flashapp.me/graphql
- Production GraphQL, not for test funds: https://api.flashapp.me/graphql
- World Bank Remittance Prices Worldwide starting point: https://remittanceprices.worldbank.org/

Verification boundary: Figma inventory/copy/starting point, research tabs and official rules/deadline were read directly. Flash operations and historical costs are research-backed implementation inputs, not independently executed API tests or a fresh World Bank corridor quote. Verify current schema, credentials, exact cost source and live FX before claiming production capability.
