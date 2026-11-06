import type { getLedger, listChamas } from "../domain/chamas";
import type { getDiasporaContext } from "../domain/diaspora";
import type { InvoiceView } from "../domain/invoices";
import type { getPayoutView } from "../domain/payouts";
import type { getReceipt } from "../domain/receipts";

export type ChamaList = ReturnType<typeof listChamas>;
export type Ledger = ReturnType<typeof getLedger>;
export type Invoice = InvoiceView;
export type PayoutView = ReturnType<typeof getPayoutView>;
export type ReceiptView = ReturnType<typeof getReceipt>;
export type DiasporaContext = ReturnType<typeof getDiasporaContext>;
export interface Me {
  user: { id: string; displayName: string; locale: string; isDemo: boolean } | null;
}
