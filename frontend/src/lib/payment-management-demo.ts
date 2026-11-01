import type { DemoPayment, PaymentFilters, PaymentSource, PaymentStatus, Reconciliation } from '../types/payment-management';

export const sourceLabels: Record<PaymentSource, string> = {
  MOCK: 'Mock Payment',
  ZALOPAY_SANDBOX: 'ZaloPay Sandbox',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
};

export const statusLabels: Record<PaymentStatus, string> = {
  SUCCESS: 'Thành công', PENDING: 'Đang chờ', FAILED: 'Thất bại',
};

export const reconciliationLabels: Record<Reconciliation, string> = {
  MATCHED: 'Khớp đơn hàng', WAITING: 'Chờ xác nhận',
  AMOUNT_MISMATCH: 'Sai số tiền', UNMATCHED: 'Chưa tìm thấy đơn',
  NEEDS_REVIEW: 'Cần kiểm tra',
};

export const initialFilters: PaymentFilters = {
  source: 'ALL', status: 'ALL', search: '', from: '', to: '',
};

const amountFormat = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export const formatPaymentMoney = (value: number) => amountFormat.format(value);
export const formatPaymentTime = (value: string) => timeFormat.format(new Date(value));

export function needsPaymentReview(payment: DemoPayment) {
  return payment.reconciliation === 'AMOUNT_MISMATCH' || payment.reconciliation === 'UNMATCHED' || payment.reconciliation === 'NEEDS_REVIEW';
}

export function filterDemoPayments(payments: DemoPayment[], filters: PaymentFilters) {
  const search = filters.search.trim().toLocaleLowerCase('vi');
  return payments.filter((payment) => {
    // Compare calendar days in Vietnam time, including generated UTC timestamps.
    const day = new Date(Date.parse(payment.createdAt) + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return (filters.source === 'ALL' || payment.source === filters.source)
      && (filters.status === 'ALL' || (filters.status === 'REVIEW'
        ? needsPaymentReview(payment) : payment.status === filters.status))
      && (!filters.from || day >= filters.from)
      && (!filters.to || day <= filters.to)
      && (!search || [payment.id, payment.orderNumber === null ? '' : `#${payment.orderNumber}`,
        payment.customer, payment.reference ?? '', payment.description]
        .some((value) => value.toLocaleLowerCase('vi').includes(search)));
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export const demoPayments: DemoPayment[] = [
  { id: 'DEMO-BANK-001', orderNumber: 1056, customer: 'Khách mẫu 01', source: 'BANK_TRANSFER', method: 'BANK_TRANSFER', amount: 75000, expectedAmount: 75000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_BANK_1056', description: 'BREWLITE 1056', failureReason: null, createdAt: '2026-10-29T14:32:00+07:00' },
  { id: 'DEMO-ZLP-002', orderNumber: 1055, customer: 'Khách mẫu 02', source: 'ZALOPAY_SANDBOX', method: 'E_WALLET', amount: 59000, expectedAmount: 59000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_ZLP_1055', description: 'Thanh toán thử nghiệm đơn #1055', failureReason: null, createdAt: '2026-10-29T14:18:00+07:00' },
  { id: 'DEMO-MOCK-003', orderNumber: 1054, customer: 'Khách mẫu 03', source: 'MOCK', method: 'BANK_CARD', amount: 45000, expectedAmount: 45000, status: 'FAILED', reconciliation: 'WAITING', reference: null, description: 'Thanh toán mô phỏng đơn #1054', failureReason: 'Giao dịch bị từ chối bởi cổng thanh toán mô phỏng.', createdAt: '2026-10-29T13:54:00+07:00' },
  { id: 'DEMO-BANK-004', orderNumber: 1053, customer: 'Khách mẫu 04', source: 'BANK_TRANSFER', method: 'BANK_TRANSFER', amount: 50000, expectedAmount: 65000, status: 'PENDING', reconciliation: 'AMOUNT_MISMATCH', reference: 'DEMO_BANK_1053', description: 'BREWLITE 1053', failureReason: null, createdAt: '2026-10-29T13:40:00+07:00' },
  { id: 'DEMO-ZLP-005', orderNumber: 1052, customer: 'Khách mẫu 05', source: 'ZALOPAY_SANDBOX', method: 'E_WALLET', amount: 89000, expectedAmount: 89000, status: 'PENDING', reconciliation: 'WAITING', reference: null, description: 'Đang chờ callback thử nghiệm', failureReason: null, createdAt: '2026-10-29T13:25:00+07:00' },
  { id: 'DEMO-MOCK-006', orderNumber: 1051, customer: 'Khách mẫu 06', source: 'MOCK', method: 'E_WALLET', amount: 62000, expectedAmount: 62000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_MOCK_1051', description: 'Thanh toán mô phỏng đơn #1051', failureReason: null, createdAt: '2026-10-29T12:10:00+07:00' },
  { id: 'DEMO-BANK-007', orderNumber: null, customer: 'Chưa xác định · mẫu', source: 'BANK_TRANSFER', method: 'BANK_TRANSFER', amount: 100000, expectedAmount: null, status: 'PENDING', reconciliation: 'UNMATCHED', reference: 'DEMO_BANK_UNKNOWN', description: 'Chuyen tien cafe', failureReason: null, createdAt: '2026-10-29T11:46:00+07:00' },
  { id: 'DEMO-ZLP-008', orderNumber: 1049, customer: 'Khách mẫu 08', source: 'ZALOPAY_SANDBOX', method: 'BANK_CARD', amount: 120000, expectedAmount: 120000, status: 'FAILED', reconciliation: 'WAITING', reference: null, description: 'Thanh toán thử nghiệm đơn #1049', failureReason: 'Tình huống mẫu: khách hủy thanh toán trên trang sandbox.', createdAt: '2026-10-28T16:08:00+07:00' },
  { id: 'DEMO-MOCK-009', orderNumber: 1048, customer: 'Khách mẫu 09', source: 'MOCK', method: 'BANK_CARD', amount: 95000, expectedAmount: 95000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_MOCK_1048', description: 'Thanh toán mô phỏng đơn #1048', failureReason: null, createdAt: '2026-10-28T15:30:00+07:00' },
  { id: 'DEMO-BANK-010', orderNumber: 1047, customer: 'Khách mẫu 10', source: 'BANK_TRANSFER', method: 'BANK_TRANSFER', amount: 42000, expectedAmount: 42000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_BANK_1047', description: 'BREWLITE 1047', failureReason: null, createdAt: '2026-10-28T10:05:00+07:00' },
  { id: 'DEMO-ZLP-011', orderNumber: 1046, customer: 'Khách mẫu 11', source: 'ZALOPAY_SANDBOX', method: 'E_WALLET', amount: 78000, expectedAmount: 78000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_ZLP_1046', description: 'Thanh toán thử nghiệm đơn #1046', failureReason: null, createdAt: '2026-10-27T17:20:00+07:00' },
  { id: 'DEMO-MOCK-012', orderNumber: 1045, customer: 'Khách mẫu 12', source: 'MOCK', method: 'E_WALLET', amount: 39000, expectedAmount: 39000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_MOCK_1045', description: 'Thanh toán mô phỏng đơn #1045', failureReason: null, createdAt: '2026-10-27T09:12:00+07:00' },
  { id: 'DEMO-BANK-013', orderNumber: 1044, customer: 'Khách mẫu 13', source: 'BANK_TRANSFER', method: 'BANK_TRANSFER', amount: 110000, expectedAmount: 110000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_BANK_1044', description: 'BREWLITE 1044', failureReason: null, createdAt: '2026-10-26T14:42:00+07:00' },
  { id: 'DEMO-ZLP-014', orderNumber: 1043, customer: 'Khách mẫu 14', source: 'ZALOPAY_SANDBOX', method: 'E_WALLET', amount: 55000, expectedAmount: 55000, status: 'SUCCESS', reconciliation: 'MATCHED', reference: 'DEMO_ZLP_1043', description: 'Thanh toán thử nghiệm đơn #1043', failureReason: null, createdAt: '2026-10-25T08:35:00+07:00' },
];

export function createDemoTransfer(sequence: number): DemoPayment {
  return {
    id: `DEMO-INCOMING-${sequence}`, orderNumber: 2000 + sequence,
    customer: `Khách chuyển khoản mẫu ${sequence}`, source: 'BANK_TRANSFER', method: 'BANK_TRANSFER',
    amount: 68000, expectedAmount: 68000, status: 'SUCCESS', reconciliation: 'MATCHED',
    reference: `DEMO_INCOMING_${sequence}`, description: `BREWLITE ${2000 + sequence}`,
    failureReason: null,
    // A fixed demo clock keeps server rendering and screenshots reproducible.
    createdAt: new Date(Date.parse('2026-10-29T14:35:00+07:00') + sequence * 60000)
      .toISOString(),
  };
}
