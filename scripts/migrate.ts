import { getDb, migrate } from "../lib/db";

async function main() {
  const db = await getDb(); // opening the pool also applies pending migrations
  const ran = await migrate(db);
  console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database is up to date.");
  await db.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
