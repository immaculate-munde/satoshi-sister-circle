import type { Db } from "../db";
import type { PaymentsProvider } from "../payments/provider";

export interface Ctx {
  db: Db;
  provider: PaymentsProvider;
  now: () => Date;
  limits: { maxPrincipalUnits: bigint; maxFeeUnits: bigint };
  receiptSecret: string;
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const notFound = (what = "Not found") => new DomainError("NOT_FOUND", what, 404);
export const forbidden = (what = "You do not have access to this chama") => new DomainError("FORBIDDEN", what, 403);
