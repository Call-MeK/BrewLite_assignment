'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, FileText, X } from 'lucide-react';
import {
  formatPaymentMoney as money, formatPaymentTime as time, needsPaymentReview,
  reconciliationLabels, sourceLabels, statusLabels,
} from '@/lib/payment-management-demo';
import type { ManagedPayment } from '@/types/payment-management';
import { syncZaloPay } from '@/services/zalopay.service';
import { getManagedPayment } from '@/services/payment-management.service';
import { useRequestCooldown } from '@/components/use-request-cooldown';

export function PaymentDetailDialog({ payment, onClose, onUpdated }: {
  payment: ManagedPayment; onClose: () => void; onUpdated: (payment: ManagedPayment) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const cooldown = useRequestCooldown('POST', `/payments/zalopay/${payment.id}/sync`);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; request.current?.abort(); };
  }, []);

  const review = needsPaymentReview(payment);
  async function sync() {
    if (syncing || cooldown.blocked || !cooldown.start()) return;
    const controller = new AbortController();
    request.current = controller;
    const token = localStorage.getItem('token');
    setSyncing(true);
    setError('');
    try {
      await syncZaloPay(payment.id, controller.signal);
      const updated = await getManagedPayment(payment.id, controller.signal);
      if (!controller.signal.aborted && localStorage.getItem('token') === token) onUpdated(updated);
    } catch (cause) {
      if (!controller.signal.aborted && localStorage.getItem('token') === token) {
        setError(cause instanceof Error ? cause.message : 'Không thể đồng bộ trạng thái ZaloPay.');
      }
    } finally { if (!controller.signal.aborted) setSyncing(false); }
  }
  const details = [
    ['Mã giao dịch', payment.id],
    ['Đơn hàng', payment.orderNumber === null ? 'Chưa xác định' : `#${payment.orderNumber}`],
    ['Khách hàng', payment.customer],
    ['Nguồn', sourceLabels[payment.source]],
    ['Phương thức', payment.method === 'E_WALLET' ? 'Ví điện tử' : payment.method === 'BANK_CARD' ? 'Thẻ ngân hàng' : 'Chuyển khoản'],
    ['Thời gian (GMT+7)', time(payment.createdAt)],
    ['Mã tham chiếu', payment.reference ?? 'Chưa có'],
    ['Nội dung', payment.description],
  ];

  return (
    <dialog ref={dialog} onClose={onClose} onClick={(event) => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }} aria-labelledby="payment-detail-title" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-lg overflow-y-auto border-l-[1.5px] border-ink bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/50">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b-[1.5px] border-ink bg-paper-deep/70 p-6 backdrop-blur">
        <div>
          <p className="kicker">Giao dịch từ hệ thống</p>
          <h2 id="payment-detail-title" className="mt-1 text-2xl font-bold">Chi tiết thanh toán</h2>
        </div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Đóng chi tiết giao dịch" autoFocus className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ticket border border-ink/25 bg-white hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X size={20} /></button>
      </div>
      <div className="space-y-6 p-6">
        <div className="rounded-ticket border border-ink/15 bg-white p-5">
          <p className="text-sm text-content-secondary">Số tiền giao dịch · {sourceLabels[payment.source]}</p>
          <p className="price mt-2 text-4xl font-bold tracking-[-0.02em]">{money(payment.amount)}</p>
          <p className={`mt-3 text-sm font-bold ${payment.status === 'SUCCESS' ? 'text-success' : payment.status === 'FAILED' ? 'text-danger' : 'text-primary'}`}>{statusLabels[payment.status]} · {reconciliationLabels[payment.reconciliation]}</p>
        </div>

        <dl className="divide-y divide-ink/10 text-sm">
          {details.map(([label, value]) => <div key={label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-3"><dt className="text-content-secondary">{label}</dt><dd className="break-words font-semibold [overflow-wrap:anywhere]">{value}</dd></div>)}
        </dl>

        <section aria-labelledby="reconciliation-title" className={`rounded-ticket border p-5 ${review ? 'border-accent bg-accent-soft/60' : 'border-ink/15 bg-white'}`}>
          <h3 id="reconciliation-title" className="flex items-center gap-2 font-bold"><FileText size={18} aria-hidden="true" /> Kiểm tra đơn hàng</h3>
          <div className="mt-4 flex justify-between gap-3 text-sm"><span className="text-content-secondary">Giá trị đơn hàng</span><span className="font-semibold">{payment.expectedAmount === null ? 'Chưa xác định' : money(payment.expectedAmount)}</span></div>
          {payment.reconciliation === 'AMOUNT_MISMATCH' && payment.expectedAmount !== null && <p className="mt-3 text-sm font-semibold text-ink">{payment.amount < payment.expectedAmount ? 'Thiếu' : 'Thừa'} {money(Math.abs(payment.expectedAmount - payment.amount))}. Cần kiểm tra trước khi xác nhận đơn.</p>}
          {payment.reconciliation === 'UNMATCHED' && <p className="mt-3 text-sm text-ink">Nội dung chuyển khoản chưa khớp mã đơn. Giao dịch được giữ để kiểm tra.</p>}
          {payment.reviewReason && <p className="mt-3 text-sm text-ink">{payment.reviewReason}</p>}
          {payment.reconciliation === 'MATCHED' && <p className="mt-3 text-sm text-success">Số tiền thanh toán thử nghiệm khớp với đơn hàng đã gắn.</p>}
          {payment.reconciliation === 'WAITING' && <p className="mt-3 text-sm text-content-secondary">{payment.failureReason ?? 'Đang chờ kết quả từ cổng thanh toán.'}</p>}
        </section>

        {payment.source === 'ZALOPAY_SANDBOX' && <div>
          <button type="button" onClick={() => void sync()} disabled={syncing || cooldown.blocked} className="btn-primary min-h-11 px-4 text-white disabled:opacity-50">{syncing ? 'Đang đồng bộ…' : cooldown.label || 'Đồng bộ trạng thái ZaloPay'}</button>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </div>}

        <section aria-labelledby="timeline-title">
          <h3 id="timeline-title" className="font-bold">Thông tin xử lý đã lưu</h3>
          <ol className="mt-4 space-y-4 text-sm">
            <li className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ticket border border-ink/15 bg-primary-light text-primary"><FileText size={16} aria-hidden="true" /></span><div><p className="font-semibold">Tạo bản ghi giao dịch</p><p className="mt-1 text-xs text-content-secondary">{time(payment.createdAt)}</p></div></li>
            <li className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ticket border border-ink/15 bg-white text-content-secondary"><Clock3 size={16} aria-hidden="true" /></span><div><p className="font-semibold">{sourceLabels[payment.source]}</p><p className="mt-1 text-xs text-content-secondary">{payment.reference ? `Mã tham chiếu: ${payment.reference}` : 'Chưa có mã tham chiếu thành công.'}</p></div></li>
            <li className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ticket border border-ink/15 bg-white text-primary"><Check size={16} aria-hidden="true" /></span><div><p className="font-semibold">{review ? 'Cần kiểm tra số tiền' : statusLabels[payment.status]}</p><p className="mt-1 text-xs text-content-secondary">{payment.failureReason ?? 'Trạng thái hiện tại của giao dịch trong hệ thống.'}</p></div></li>
          </ol>
        </section>
        <p className="rounded-ticket border border-dashed border-ink/25 bg-white/60 p-4 text-xs leading-relaxed text-content-secondary">Giao dịch mock và sandbox không thể hiện tiền thật đã nhận. Đồng bộ ZaloPay sẽ truy vấn nhà cung cấp và cập nhật trạng thái đã xác minh.</p>
      </div>
    </dialog>
  );
}
