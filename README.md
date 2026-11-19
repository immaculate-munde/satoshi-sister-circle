# Key-ching

_Your chama on Lightning._

**Three women, one pot, no notebook.** A mobile-first PWA for rotating savings circles (chamas) settled over
Bitcoin Lightning through Flash. Members agree an amount, a cadence and a payout order; each member pays a
Lightning invoice; everyone sees the same live ledger; when the round is fully funded the pot is paid
automatically to the next member, and branded receipts are issued.

Built for the Sovereign Stack / Satoshi Sister Circle hackathon. See [`CHECKLIST.md`](CHECKLIST.md) for exactly
what is implemented, simulated and blocked.

> **Custody, honestly.** Flash is a custodial provider. While a round fills, the operator who holds the Flash
> API key controls the funds. This app *automates the agreed payout*; it does not make it impossible for an
> operator to take the money. This build is for test funds only. Pooling deposits in Kenya needs a legal /
> licensed-partner review before any real-money use.

## Quick start (demo mode, no secrets needed)

Requires Node.js 22.13+ (uses the built-in `node:sqlite`; tested on Node 24.18).

```bash
npm ci
cp .env.example .env.local          # demo defaults work as-is
npm run db:migrate
npm run db:seed -- --scenario fresh # or: --scenario last-payment (Wanjiku + Faith paid, Amina pending)
npm run dev                         # Next.js web + payout worker together
```

Open http://localhost:3000 at a phone-sized viewport (390x844). On **Get started**, pick a demo persona
(Amina Otieno, Wanjiku or Faith). Use separate browser profiles to play all three members at once.

Demo mode is labelled on every screen: payments go to a **simulated provider**, the QR is deliberately not a
valid Lightning invoice, and "Simulate test-wallet payment" moves balances only inside the demo provider's own
books. The app still learns about payments only by asking the provider, exactly as it does with Flash.

### Three-minute demo script

1. Welcome → **Get started** as Amina.
2. **Create**: Umoja Women Chama, KES 5,000 weekly, Bitcoin, Wanjiku → Faith → Amina. The ledger shows the invite code.
   (Or use the seeded Umoja group.)
3. As each member: **Contribute** → QR → **Simulate test-wallet payment**. The ledger ticks 0/3 → 1/3 → 2/3 → 3/3 live.
4. The third settlement queues one payout. The worker sends it; the Payout screen goes *queued → sending → sent*.
5. Open the contribution receipt (KES 5,000) and the payout receipt (KES 15,000); Share / Download PDF.
6. Home → **Total saved** → Pay in from abroad: Njeri (London) covers Amina's obligation (£30 ≈ KES 5,000, illustrative),
   with the historical £1.02–£1.32 remittance benchmark and every missing leg disclosed.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Web (Next.js) + worker via `concurrently` |
| `npm run dev:web` / `npm run worker` | Run them separately |
| `npm run db:migrate` | Apply SQL migrations in `lib/db/migrations` |
| `npm run db:seed -- --scenario fresh\|last-payment` | Reset + seed. Refuses unless `PAYMENTS_PROVIDER=demo` |
| `npm run reconcile` | One reconciliation pass + prints audit-chain checkpoint hashes |
| `npm run flash:smoke` | Flash test API spike (see below) |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint |
| `npm run test` | Unit tests (money math, schedule, config validation) |
| `npm run test:integration` | Payment engine: idempotency, races, unknown outcomes, authz, diaspora |
| `npm run test:e2e` | Playwright at 390x844: seeds `last-payment`, starts the app, walks the screens, saves screenshots to `test-results/screens/`. Run `npx playwright install chromium` once. Set `E2E_BASE_URL` to reuse a running server. |
| `npm run build` / `npm start` | Production build / server |

## Architecture

```text
PWA (Next.js App Router, client screens)
  │  cookie session, same-origin checks, idempotency keys, rate limits
  ▼
Route handlers (app/api/*)  ──►  domain services (lib/domain/*)  ──►  SQLite (WAL, BEGIN IMMEDIATE)
                                         │                               ▲   hash-chained ledger_events
                                         ▼                               │
                              PaymentsProvider (lib/payments)            │
                              ├─ demo.ts  (simulated, own books)         │
                              └─ flash.ts (Flash test GraphQL)           │
                                         ▲                               │
              worker/index.ts: invoice watchers + 30 s reconciler + payout processor (leases)
                                         │
                       DB commit ──► SSE /api/chamas/:id/events ──► live ledger
```

- **Money is never a float.** Integer minor/settlement units + asset tag in the DB; `BigInt` in code; integer strings in JSON.
  KES is a display denomination; settlement is sats (`BTC_SAT`) or Flash USD-stable cents (`USD_CENT`). One asset per cycle;
  BTC and USD balances are never added together.
- **Paid means the provider said so.** `applyProviderStatus` is the only code path that marks money received. In one
  transaction it dedupes the provider event, checks wallet/amount, marks the obligation paid, appends audit events, writes an
  immutable receipt and inserts the uniquely-keyed payout intent when the round is fully funded.
- **Payouts.** The worker leases a payout, re-validates funding, recipient and caps, commits `PROCESSING`, then calls the
  provider. Timeouts become `UNKNOWN` and are resolved by looking up provider history by request id, never by resending.
  With the demo provider that lookup is definitive (a miss means not sent, so it re-queues). With Flash it is not, so an
  unresolved payout stops for operator review. Rotation advances only after confirmed success.
- **Late and duplicate payments.** Expired invoices keep being reconciled for 24 h. A late settlement on an already-paid
  obligation is recorded as an overpayment liability, never a second credit. Underpayments leave the obligation open.
- **Audit log.** `ledger_events` is append-only (DB triggers) and hash-chained. It is tamper-*evident* relative to an exported
  checkpoint (`npm run reconcile` prints heads), not tamper-proof against someone who rewrites the whole chain.
- **Receipts** are immutable snapshots (DB trigger), SHA-256 content hash + HMAC signature, rendered on screen and as a
  branded PDF (`pdf-lib`) from the same artwork primitives.
- **Authorization.** Every read goes through `requireMember`; non-members get 404 for any ledger, invoice, payout or receipt id.

### Repository map

```text
app/                 screens (10 Figma frames) + api/ route handlers
components/          shared UI primitives, art, i18n provider
features/            chamas (cards, ledger parts, roster editor, invites), payments (QR panel), receipts (ticket, PDF)
lib/db/              SQLite access, transactions, migrations/001_init.sql
lib/domain/          chamas, invoices (settlement), payouts, receipts, diaspora, ledger hash chain, fx, schedule
lib/payments/        provider.ts contract, demo.ts, flash.ts
lib/money/           exact conversion and formatting
lib/auth/            sessions
i18n/                English + Swahili catalogs (Swahili needs native-speaker review)
worker/              persistent worker and shared tick
scripts/             migrate, seed, reconcile, flash-smoke, export-brand
tests/               unit, integration, e2e (Playwright)
public/brand/        brand assets (currently placeholders, see its README)
```

## Flash test mode

1. Ask Flash mentors for a **test** account, funded test wallets and an API key with least-privilege scopes
   (read_wallet, read_transactions, write_transactions). Kenyan +254 registration may not work.
2. In `.env.local`: `PAYMENTS_PROVIDER=flash`, `NEXT_PUBLIC_DEMO_MODE=false`, `ALLOW_SIMULATED_PAYMENTS=false`,
   `FLASH_API_KEY`, `FLASH_BTC_WALLET_ID`, `FLASH_USD_WALLET_ID`, `FLASH_NETWORK`, a 12+ char `AUTH_PASSCODE`
   and random 24+ char `SESSION_SECRET`, `INTERNAL_WORKER_SECRET`, `RECEIPT_SIGNING_SECRET`. Startup refuses placeholders,
   simulation, a mismatched mode badge or the production endpoint.
3. `npm run flash:smoke` lists wallets and creates one tiny invoice per asset. Pay them from a second permitted wallet,
   then `npm run flash:smoke -- --status <bolt11>`. To test an internal send:
   `npm run flash:smoke -- --send-internal <walletId> --asset BTC_SAT --amount 10 --confirm`.
4. Save the schema (`scripts/flash-schema.graphql`) and fix any drift in `lib/payments/flash.ts`. The adapter was written from
   the research primer and **has not yet been executed against the Flash test API.**

Flash operations used: `me.defaultAccount.wallets`, `lnInvoiceCreate`, `lnUsdInvoiceCreate`, `lnInvoicePaymentStatus`,
`intraLedgerPaymentSend`, `intraLedgerUsdPaymentSend`, `lnInvoiceFeeProbe` + `lnInvoicePaymentSend` (adapter only),
`me.defaultAccount.transactions`, `accountDefaultWallet`. Header `X-API-KEY`. No WebSocket URL is guessed; invoices are
watched by polling plus the 30 s reconciler.

In Flash mode, members' payout wallets are verified by Flash username when the chama is created, and invoices show a real
BOLT11 QR plus an **Open in wallet** (`lightning:`) link. Paying from an in-app member wallet is not offered.

## Deployment

- **Web:** any Node host running `npm run build && npm start`. **Not** serverless with ephemeral disk: SQLite needs a
  persistent volume (`DATABASE_URL=file:/data/chama.db`).
- **Worker:** a persistent process on the same volume, `npm run worker`, restarted on failure (systemd / Fly machine / Render
  worker). It is safe to restart at any time: open invoices and payout leases live in the DB. A `PROCESSING` payout whose lease
  expired becomes `UNKNOWN` and is reconciled, never resent.
- **Cron fallback:** `POST /api/internal/tick` with header `x-worker-secret: $INTERNAL_WORKER_SECRET` runs one pass.
- **Health:** `GET /api/health` reports mode, worker heartbeat age, last reconciliation and payouts needing operator review.
- **Migrations:** `npm run db:migrate` before starting a new version (the app also applies pending migrations on boot).
- **Scaling:** SQLite + one worker is the supported setup. For several web instances or workers, move to Postgres (the SQL is
  portable; replace `BEGIN IMMEDIATE` with `SELECT … FOR UPDATE`/serializable transactions) and a shared rate limiter.
- **Diagnostics:** logs redact `fk_…` API keys and bearer tokens. Never paste `.env.local`, SMS codes or tokens into issues.

## Design

Visual tokens (soft paper, sage wash, money green, deep forest, Bitcoin orange, ink, muted), Plus Jakarta Sans, pill buttons
and the scalloped receipt follow the brief. The Figma file (`eTSzwsezboz0KoVJrbifAI`) could not be read from this session,
so layouts are built from the brief's screen notes rather than pixel-matched. Once Figma MCP access is available, compare each
screen with its frame (`npm run test:e2e` writes 390x844 screenshots) and replace the placeholder art in `public/brand/`.

Intentional differences from the prototype: no fake `9:41` status bar; paid/pending badges follow data (the prototype's
1/3 vs KES 10,000 mismatch is fixed); "settled in 2s", "a few pence" and "saves about £1.20" are not shown because they
are not measured; non-KES-5,000 amount chips are visibly disabled.

## Limitations and roadmap

Not built: phone OTP auth (demo personas / passcode instead), GBP on-ramp, M-Pesa / KES cash-out, cross-asset payout,
Lightning-address payouts, notifications, late fees, random draw, loans, USSD, self-custody. Roadmap: Flash schema pinning
after the spike, OTP sign-in, Postgres, per-group Flash sub-accounts, self-custodial payout destinations.

## License and acknowledgements

MIT (see `LICENSE`). Built with Next.js, React, Tailwind CSS, Zod, qrcode.react, pdf-lib, graphql-ws, Vitest, Playwright.
Original design by Immaculate Munde (Figma). Remittance benchmark: World Bank Remittance Prices Worldwide (historical, rounded).
Code written with AI assistance (Claude Code).
