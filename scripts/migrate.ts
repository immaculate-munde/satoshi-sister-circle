import { getDb, migrate } from "../lib/db";

const ran = migrate(getDb());
console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database is up to date.");
