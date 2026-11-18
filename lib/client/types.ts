import type { getLedger, listChamas } from "../domain/chamas";
import type { getDiasporaContext } from "../domain/diaspora";
import type { InvoiceView } from "../domain/invoices";
import type { getPayoutView } from "../domain/payouts";
import type { getReceipt } from "../domain/receipts";

export type ChamaList = Awaited<ReturnType<typeof listChamas>>;
export type Ledger = Awaited<ReturnType<typeof getLedger>>;
export type Invoice = InvoiceView;
export type PayoutView = Awaited<ReturnType<typeof getPayoutView>>;
export type ReceiptView = Awaited<ReturnType<typeof getReceipt>>;
export type DiasporaContext = Awaited<ReturnType<typeof getDiasporaContext>>;
export interface Me {
  user: { id: string; displayName: string; locale: string; isDemo: boolean } | null;
}
