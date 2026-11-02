export type PaymentSource = 'MOCK' | 'ZALOPAY_SANDBOX' | 'BANK_TRANSFER';
export type PaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED';
export type Reconciliation = 'MATCHED' | 'WAITING' | 'AMOUNT_MISMATCH' | 'UNMATCHED' | 'NEEDS_REVIEW';

export interface ManagedPayment {
  id: string;
  orderNumber: number | null;
  customer: string;
  source: PaymentSource;
  method: 'E_WALLET' | 'BANK_CARD' | 'BANK_TRANSFER';
  amount: number;
  expectedAmount: number | null;
  status: PaymentStatus;
  reconciliation: Reconciliation;
  reference: string | null;
  description: string;
  failureReason: string | null;
  reviewReason?: string | null;
  createdAt: string;
}

// Retained for the standalone prototype fixtures.
export type DemoPayment = ManagedPayment;

export interface PaymentManagementResult {
  items: ManagedPayment[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { bank: number; test: number; pending: number; attention: number };
}

export interface PaymentFilters {
  source: PaymentSource | 'ALL';
  status: PaymentStatus | 'ALL' | 'REVIEW';
  search: string;
  from: string;
  to: string;
}
