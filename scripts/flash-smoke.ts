/**
 * Flash spike / smoke test against the Flash TEST GraphQL API.
 *   npm run flash:smoke                      read-only: list wallets, create a 1-unit invoice per asset
 *   npm run flash:smoke -- --status <bolt11> check an invoice's status
 *   npm run flash:smoke -- --send-internal <walletId> --asset BTC_SAT --amount 10 --confirm
 *                                            send a tiny internal transfer (explicit --confirm required)
 * Never prints the API key. Refuses production endpoints.
 */
import { randomUUID } from "node:crypto";
import { config } from "../lib/config";
import { FlashProvider } from "../lib/payments/flash";

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const cfg = config();
  if (cfg.mode !== "flash") {
    console.error("Set PAYMENTS_PROVIDER=flash (and the FLASH_* variables) in .env.local first.");
    process.exit(1);
  }
  const flash = new FlashProvider({
    graphqlUrl: cfg.flash.graphqlUrl,
    apiKey: cfg.flash.apiKey,
    btcWalletId: cfg.flash.btcWalletId,
    usdWalletId: cfg.flash.usdWalletId,
    network: cfg.flash.network,
  });
  console.log(`Endpoint: ${cfg.flash.graphqlUrl}`);

  const wallets = await flash.listWallets();
  console.log("Wallets:", wallets.map((w) => ({ id: `${w.id.slice(0, 6)}...`, currency: w.walletCurrency, balance: w.balance })));
  for (const [label, wid] of [
    ["FLASH_BTC_WALLET_ID", cfg.flash.btcWalletId],
    ["FLASH_USD_WALLET_ID", cfg.flash.usdWalletId],
  ]) {
    console.log(`${label}: ${wallets.some((w) => w.id === wid) ? "found on this account" : "NOT FOUND on this account"}`);
  }

  const status = arg("--status");
  if (status) {
    console.log("Status:", await flash.getInvoiceStatus({ paymentHash: "", bolt11: status, walletId: cfg.flash.btcWalletId }));
    return;
  }

  const dest = arg("--send-internal");
  if (dest) {
    if (!args.includes("--confirm")) {
      console.error("Refusing to move funds without --confirm.");
      process.exit(1);
    }
    const asset = (arg("--asset") ?? "BTC_SAT") as "BTC_SAT" | "USD_CENT";
    const amount = arg("--amount") ?? "10";
    if (BigInt(amount) > cfg.maxPrincipalUnits) throw new Error("Amount above PAYMENT_MAX_PRINCIPAL_UNITS");
    const requestId = `smoke-${randomUUID()}`;
    const res = await flash.payInternal({
      sourceWalletId: asset === "BTC_SAT" ? cfg.flash.btcWalletId : cfg.flash.usdWalletId,
      destinationWalletId: dest,
      asset,
      amount,
      requestId,
      memo: "Chama smoke test",
    });
    console.log("Internal send:", res, "requestId:", requestId);
    return;
  }

  for (const asset of ["BTC_SAT", "USD_CENT"] as const) {
    const inv = await flash.createInvoice({
      walletId: asset === "BTC_SAT" ? cfg.flash.btcWalletId : cfg.flash.usdWalletId,
      asset,
      amount: asset === "BTC_SAT" ? "10" : "1",
      memo: "Chama smoke test",
      expiresInSeconds: 600,
      requestId: randomUUID(),
    });
    console.log(`${asset} invoice: hash=${inv.paymentHash.slice(0, 12)}... bolt11=${inv.bolt11.slice(0, 24)}...`);
    console.log("  Pay it from a second permitted test wallet, then run: npm run flash:smoke -- --status <bolt11>");
  }
}

main().catch((e) => {
  console.error("Smoke test failed:", (e as Error).message);
  process.exit(1);
});
