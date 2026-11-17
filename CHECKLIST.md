# Implemented / simulated / blocked

Status as of 6 November 2026. **Implemented** means working and covered by tests or a verified run.
**Simulated** means it works end to end against the labelled demo provider only. **Blocked** means it needs
something outside this repo.

## Screens (all 10 at 390x844, plus auth, invite, roster editor, error states)

| Screen | Status | Notes |
| --- | --- | --- |
| 01 Splash | Removed | `/` redirects straight to the landing page |
| 02 Welcome | Implemented | Sign-in dialog, invite-code dialog |
| 03 Home | Implemented | Totals come from settled records; BTC and USD totals shown separately |
| 04 Create Chama | Implemented | Weekly/monthly/custom, BTC/USD-stable, roster editor (add, remove, rename, reorder, keyboard) |
| 05 Ledger | Implemented | Live via SSE, rotation, invites, history, hash-chained activity log |
| 06 Contribute QR | Implemented | QR, copy, expiry countdown, regenerate; fixed-amount chips |
| 07 Payment Success | Implemented | Re-checks canonical invoice on reload |
| 08 Payout | Implemented | Queued / sending / sent / failed / unknown / operator-review states |
| 09 Diaspora UK | Implemented (legs disclosed) | GBP on-ramp, KES off-ramp and live FX are not integrated, and the screen says so |
| 10 Receipt | Implemented | Contribution, payout and diaspora kinds; Web Share + PDF |
| Pixel match to Figma | **Blocked** | No Figma MCP access in the build session; built from brief tokens |
| Original logo + receipt art | **Blocked** | Placeholders in `public/brand/` until exported from Figma |

## Money engine

| Capability | Status |
| --- | --- |
| Exact integer/BigInt money, deterministic half-up rounding, obligations sum to pot | Implemented (unit tests) |
| One settlement asset per cycle; preferences saved, cross-asset payout refused with explanation | Implemented |
| Invoice create/reuse, uncertain-creation recovery by request id | Implemented |
| Settlement only from provider status; dedupe; wallet/amount verification | Implemented (integration tests) |
| Unique payout intent under concurrent final payments | Implemented (integration tests) |
| Payout leases, two-worker safety, retry with backoff, UNKNOWN + reconcile, operator review | Implemented (integration tests) |
| Late settlement of expired invoice becomes an overpayment liability; underpayment stays open | Implemented (integration tests) |
| Immutable receipts + append-only hash-chained audit log | Implemented (DB triggers + tests) |
| Fee reserve accounting | Partial: fees measured and recorded separately from principal; internal transfers are 0 in demo. No separate reserve wallet yet |

## Payments provider

| Item | Status |
| --- | --- |
| Demo provider (own books, invoice + transfer idempotency) | **Simulated** |
| Flash adapter (BTC + USD invoices, status, intraledger payouts, tx history, destination lookup) | Written, **not yet executed**: blocked on Flash test credentials |
| `npm run flash:smoke` spike script | Implemented, not yet run against Flash |
| Flash subscriptions (`myUpdates`) | Not implemented: WebSocket URL unconfirmed; polling + 30 s reconciler instead |
| Real test settlement + outgoing payout proof for judging | **Blocked** on Flash access |

## Platform

| Item | Status |
| --- | --- |
| Sessions, membership checks on every endpoint, same-origin CSRF check, rate limits, idempotency keys | Implemented |
| Phone OTP / magic link | Not implemented (demo personas; passcode in Flash mode) |
| English + Swahili | Implemented; Swahili needs native-speaker review |
| PWA manifest, static-only service worker, offline read-only banner | Implemented |
| `/api/health`, worker heartbeat, redacted logs | Implemented |
| Postgres | Not implemented (SQLite + single worker supported) |

## Before submission (18 Nov 2026)

- [ ] Connect Figma MCP, compare screenshots, export original assets
- [ ] Flash spike with mentor credentials; pin schema; record real test invoice + payout proof
- [ ] Deploy web + worker on persistent disk; record backup demo video
- [ ] Secret scan (gitleaks), public repo check while logged out, fresh-clone install from README
- [ ] Confirm submission time and timezone with organisers
