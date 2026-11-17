import { z } from "zod";

const PLACEHOLDER = /^(SET_|CONFIRM_|GENERATE_|PUBLIC_ANON|SERVER_ONLY|OPTIONAL_)/;

const intString = z.string().regex(/^\d+$/, "must be a non-negative integer");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("true"),
  PAYMENTS_PROVIDER: z.enum(["demo", "flash"]).default("demo"),
  FLASH_GRAPHQL_URL: z.string().default("https://api.test.flashapp.me/graphql"),
  FLASH_WS_URL: z.string().default(""),
  FLASH_API_KEY: z.string().default(""),
  FLASH_BTC_WALLET_ID: z.string().default(""),
  FLASH_USD_WALLET_ID: z.string().default(""),
  FLASH_NETWORK: z.string().default(""),
  PAYMENT_MAX_FEE_UNITS: intString.default("10"),
  PAYMENT_MAX_PRINCIPAL_UNITS: intString.default("20000"),
  DATABASE_URL: z.string().default("file:./data/chama.db"),
  SESSION_SECRET: z.string().default(""),
  INTERNAL_WORKER_SECRET: z.string().default(""),
  RECEIPT_SIGNING_SECRET: z.string().default(""),
  FX_PROVIDER: z.enum(["demo", "live"]).default("demo"),
  RECONCILE_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(600).default(30),
  ALLOW_SIMULATED_PAYMENTS: z.enum(["true", "false"]).default("false"),
  FLASH_ALLOW_PRODUCTION: z.enum(["true", "false"]).default("false"),
  AUTH_PASSCODE: z.string().default(""),
});

export type AppConfig = ReturnType<typeof loadConfig>;

function devSecret(name: string): string {
  // Deterministic, clearly-not-production fallback so a fresh clone runs in demo mode without secrets.
  return `dev-only-${name}-do-not-use-in-production`;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const raw = schema.parse(env);
  const problems: string[] = [];
  const warnings: string[] = [];
  const isProd = raw.NODE_ENV === "production";

  const secret = (name: "SESSION_SECRET" | "INTERNAL_WORKER_SECRET" | "RECEIPT_SIGNING_SECRET") => {
    const v = raw[name];
    if (!v || PLACEHOLDER.test(v)) {
      // Demo mode holds no real money, so a fresh clone may build and run without secrets. Flash mode may not.
      if (raw.PAYMENTS_PROVIDER === "flash") problems.push(`${name} must be set to a random secret`);
      else if (isProd) warnings.push(`${name} is not set; using an insecure demo-only default`);
      return devSecret(name);
    }
    if (v.length < 24) problems.push(`${name} is too short (min 24 chars)`);
    return v;
  };

  const flash = raw.PAYMENTS_PROVIDER === "flash";
  if (flash) {
    for (const key of ["FLASH_API_KEY", "FLASH_USD_WALLET_ID", "FLASH_GRAPHQL_URL"] as const) {
      if (!raw[key] || PLACEHOLDER.test(raw[key])) problems.push(`${key} is required in flash mode`);
    }
    if (raw.FX_PROVIDER !== "live") problems.push("FX_PROVIDER=live is required in flash mode (demo rates must never price real invoices)");
    if (raw.ALLOW_SIMULATED_PAYMENTS === "true") {
      problems.push("ALLOW_SIMULATED_PAYMENTS must be false when PAYMENTS_PROVIDER=flash (no silent simulation)");
    }
    if (!raw.AUTH_PASSCODE || PLACEHOLDER.test(raw.AUTH_PASSCODE) || raw.AUTH_PASSCODE.length < 12) {
      problems.push("AUTH_PASSCODE (12+ chars) is required in flash mode so strangers cannot sign in");
    }
    if (raw.NEXT_PUBLIC_DEMO_MODE === "true") {
      problems.push("NEXT_PUBLIC_DEMO_MODE=true does not match PAYMENTS_PROVIDER=flash");
    }
    if (/api\.flashapp\.me/.test(raw.FLASH_GRAPHQL_URL) && !/test/.test(raw.FLASH_GRAPHQL_URL) && raw.FLASH_ALLOW_PRODUCTION !== "true") {
      problems.push("FLASH_GRAPHQL_URL points at production (real money). Set FLASH_ALLOW_PRODUCTION=true to confirm you intend that");
    }
  } else if (raw.NEXT_PUBLIC_DEMO_MODE === "false") {
    problems.push("NEXT_PUBLIC_DEMO_MODE=false does not match PAYMENTS_PROVIDER=demo");
  }

  const cfg = {
    isProd,
    mode: raw.PAYMENTS_PROVIDER,
    demo: !flash,
    allowSimulatedPayments: !flash && raw.ALLOW_SIMULATED_PAYMENTS === "true",
    flash: {
      graphqlUrl: raw.FLASH_GRAPHQL_URL,
      wsUrl: raw.FLASH_WS_URL && !PLACEHOLDER.test(raw.FLASH_WS_URL) ? raw.FLASH_WS_URL : "",
      apiKey: raw.FLASH_API_KEY,
      btcWalletId: raw.FLASH_BTC_WALLET_ID,
      usdWalletId: raw.FLASH_USD_WALLET_ID,
      network: raw.FLASH_NETWORK && !PLACEHOLDER.test(raw.FLASH_NETWORK) ? raw.FLASH_NETWORK : "unconfirmed",
    },
    bitcoinEnabled: !flash || (!!raw.FLASH_BTC_WALLET_ID && !PLACEHOLDER.test(raw.FLASH_BTC_WALLET_ID)),
    liveFunds: flash && !/test/.test(raw.FLASH_GRAPHQL_URL),
    maxFeeUnits: BigInt(raw.PAYMENT_MAX_FEE_UNITS),
    maxPrincipalUnits: BigInt(raw.PAYMENT_MAX_PRINCIPAL_UNITS),
    databasePath: raw.DATABASE_URL.replace(/^file:/, ""),
    sessionSecret: secret("SESSION_SECRET"),
    workerSecret: secret("INTERNAL_WORKER_SECRET"),
    receiptSecret: secret("RECEIPT_SIGNING_SECRET"),
    authPasscode: raw.AUTH_PASSCODE,
    fxProvider: raw.FX_PROVIDER,
    reconcileIntervalSeconds: raw.RECONCILE_INTERVAL_SECONDS,
    problems,
    warnings,
  };
  return cfg;
}

let cached: AppConfig | null = null;

export function config(): AppConfig {
  if (!cached) {
    cached = loadConfig();
    if (cached.problems.length) {
      throw new Error(`Invalid configuration:\n- ${cached.problems.join("\n- ")}`);
    }
    for (const w of cached.warnings) console.warn(`[config] ${w}`);
  }
  return cached;
}

export function resetConfigForTests() {
  cached = null;
}
