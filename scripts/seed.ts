/**
 * Seed demo data. Refuses to run unless PAYMENTS_PROVIDER=demo, and only ever touches the demo
 * provider's simulated books. Usage: npm run db:seed -- --scenario fresh|last-payment
 */
import { config } from "../lib/config";
import { getDb, id, many, migrate, nowIso, run } from "../lib/db";
import { createChama } from "../lib/domain/chamas";
import { acceptInvite } from "../lib/domain/invites";
import { reconcileInvoice, requestInvoice } from "../lib/domain/invoices";
import { serverCtx } from "../lib/domain/server";
import { toEatDateString } from "../lib/domain/schedule";
import { DemoProvider } from "../lib/payments/demo";

const scenario = (() => {
  const i = process.argv.indexOf("--scenario");
  return (i >= 0 ? process.argv[i + 1] : "fresh") as "fresh" | "last-payment";
})();
if (!["fresh", "last-payment"].includes(scenario)) {
  console.error("Unknown scenario. Use --scenario fresh or --scenario last-payment");
  process.exit(1);
}

const cfg = config();
{
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "";
    }
  })();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  if (!local && !process.argv.includes("--confirm")) {
    console.error(`Refusing to wipe the remote database at ${host || "(unset DATABASE_URL)"}. Seeding DROPS all app tables.
Re-run with --confirm if that is really what you want.`);
    process.exit(1);
  }
}
if (cfg.mode !== "demo") {
  console.error("Refusing to seed: PAYMENTS_PROVIDER is not 'demo'. Seeds never write into a real provider ledger.");
  process.exit(1);
}

/** Next Friday (or today if it is Friday) in EAT, as YYYY-MM-DD. Matches the Figma Fri 6/13/20 Nov rhythm. */
function upcomingFriday(): string {
  const eatNow = new Date(Date.now() + 3 * 3600_000);
  let add = (5 - eatNow.getUTCDay() + 7) % 7;
  // Due time is 18:00 EAT; if this Friday's is already past, use next Friday.
  if (add === 0 && eatNow.getUTCHours() >= 18) add = 7;
  return toEatDateString(new Date(Date.now() + add * 86400_000));
}

async function main() {
  const db = await getDb();
  // Reset: drop every app table (triggers go with them) and re-run migrations. Only our own tables are touched,
  // never the schema itself, so Supabase's roles, extensions and grants are left alone.
  for (const t of await many<{ tablename: string }>(db, "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")) {
    await db.exec(`DROP TABLE IF EXISTS public."${t.tablename}" CASCADE`);
  }
  await db.exec("DROP FUNCTION IF EXISTS public.forbid_change() CASCADE");
  await migrate(db);

  const ctx = await serverCtx();
  const users: Record<string, string> = {};
  for (const name of ["Amina Otieno", "Wanjiku", "Faith"]) {
    users[name] = id();
    await run(db, "INSERT INTO users (id, display_name, is_demo, created_at) VALUES (:id, :n, 1, :now)", {
      id: users[name],
      n: name,
      now: nowIso(),
    });
  }

  const umoja = await createChama(ctx, users["Amina Otieno"], {
    name: "Umoja Women Chama",
    contributionKes: "5000",
    frequency: "WEEKLY",
    settlementAsset: "BTC_SAT",
    firstDueDate: upcomingFriday(),
    members: [
      { displayName: "Wanjiku", isMe: false, payoutPreference: "BTC" },
      { displayName: "Faith", isMe: false, payoutPreference: "USD" },
      { displayName: "Amina Otieno", isMe: true, payoutPreference: "BTC" },
    ],
  });
  const seats = await many<{ id: string; display_name: string }>(db, "SELECT id, display_name FROM members WHERE group_id = :g", {
    g: umoja.group.id,
  });
  for (const name of ["Wanjiku", "Faith"]) {
    await acceptInvite(ctx, umoja.invite.code, users[name], seats.find((s) => s.display_name === name)!.id);
  }

  // Second Home card: a real, record-backed group (8 members, KES 2,000 monthly).
  const firstOfNextMonth = (() => {
    const d = new Date(Date.now() + 3 * 3600_000);
    return toEatDateString(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12)));
  })();
  await createChama(ctx, users["Amina Otieno"], {
    name: "Mama Mboga Savers",
    contributionKes: "2000",
    frequency: "MONTHLY",
    settlementAsset: "BTC_SAT",
    firstDueDate: firstOfNextMonth,
    members: ["Amina Otieno", "Mama Akinyi", "Zawadi", "Nafula", "Chebet", "Achieng", "Mwende", "Halima"].map((n, i) => ({
      displayName: n,
      isMe: i === 0,
      payoutPreference: "BTC" as const,
    })),
  });

  if (scenario === "last-payment") {
    const provider = ctx.provider as DemoProvider;
    for (const name of ["Wanjiku", "Faith"]) {
      const inv = await requestInvoice(ctx, { userId: users[name], groupId: umoja.group.id, kind: "CONTRIBUTION" });
      const wallet = `user:${users[name]}:BTC_SAT`;
      await provider.ensureWallet(wallet, `${name} test wallet`, "BTC_SAT", 1_000_000n);
      await provider.simulatePayment(inv.paymentHash!, wallet);
      await reconcileInvoice(ctx, inv.id);
    }
  }

  console.log(`Seeded scenario "${scenario}" (DEMO provider, simulated funds only).`);
  console.log(`  Umoja Women Chama invite code: ${umoja.invite.code}`);
  console.log("  Sign in as Amina Otieno, Wanjiku or Faith from the Welcome screen.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
