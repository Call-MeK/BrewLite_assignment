'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Wallet } from 'lucide-react';
import { useRequestCooldown } from '@/components/use-request-cooldown';
import { finishPaidPendingOrder } from '@/lib/pending-order';
import { getOrder, type OrderDetail, type PaymentMethod } from '@/services/order.service';
import { cancelZaloPay, createZaloPay, getLatestZaloPay, getZaloPayConfig, syncZaloPay, type ZaloPayPayment } from '@/services/zalopay.service';

export function ZaloPaySandboxPanel({ order, onOrderUpdated, onPendingChange, onPaymentChange }: {
  order: OrderDetail;
  onOrderUpdated: (order: OrderDetail) => void;
  onPendingChange: (pending: boolean) => void;
  onPaymentChange: (payment: ZaloPayPayment | null) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [payment, setPayment] = useState<ZaloPayPayment | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('E_WALLET');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const request = useRef<AbortController | null>(null);
  const createCooldown = useRequestCooldown('POST', '/payments/zalopay');
  const syncCooldown = useRequestCooldown('POST', `/payments/zalopay/${payment?.id || 'pending'}/sync`);
  const refreshCooldown = useRequestCooldown('GET', `/payments/zalopay/orders/${order.id}`);
  const reserveRefresh = refreshCooldown.start;

  const publish = useCallback((next: ZaloPayPayment | null, updated: OrderDetail) => {
    setPayment(next);
    onPaymentChange(next);
    onOrderUpdated(updated);
    onPendingChange(next?.status === 'PENDING' || next?.status === 'SUCCESS');
    if (next && next.status !== 'PENDING') sessionStorage.removeItem(`brewlite-zalopay-${updated.id}-${next.method}`);
    if (updated.status === 'PAID' && localStorage.getItem('brewlite-pending-order-id') === updated.id) {
      finishPaidPendingOrder(localStorage, updated.id);
      window.dispatchEvent(new Event('cart-changed'));
    }
  }, [onOrderUpdated, onPendingChange, onPaymentChange]);

  const refreshPayment = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const token = localStorage.getItem('token');
    const current = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    try {
      const [config, latest] = await Promise.all([
        getZaloPayConfig(controller.signal), getLatestZaloPay(order.id, controller.signal),
      ]);
      if (!current()) return;
      const updated = await getOrder(order.id);
      if (!current()) return;
      setEnabled(config.enabled);
      setLoaded(true);
      setError('');
      publish(latest, updated);
    } catch {
      if (current()) setError('Không thể cập nhật trạng thái ZaloPay. Chọn Tải lại để thử lại.');
    } finally {
      if (request.current === controller) request.current = null;
      if (current()) setBusy(false);
    }
  }, [order.id, publish]);

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setBusy(true);
    setLoaded(false);
    setError('');
    setPayment(null);
    setEnabled(false);
    onPaymentChange(null);
    onPendingChange(true);
    void refreshPayment();
    return () => { request.current?.abort(); request.current = null; };
  }, [refreshPayment, reload, onPendingChange, onPaymentChange]);

  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === 'visible' && reserveRefresh()) void refreshPayment(); };
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    const waiting = payment?.status === 'PENDING'
      || (payment?.status === 'SUCCESS' && !payment.reviewReason && ['PENDING', 'PAYMENT_FAILED'].includes(order.status));
    const timer = waiting ? window.setInterval(refreshVisible, 15000) : null;
    return () => {
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [refreshPayment, reserveRefresh, payment?.status, payment?.reviewReason, order.status]);

  useEffect(() => {
    let token = localStorage.getItem('token');
    function onAuthChange() {
      const next = localStorage.getItem('token');
      if (next === token) return;
      token = next;
      request.current?.abort();
      request.current = null;
      setPayment(null);
      onPaymentChange(null);
      setLoaded(false);
      setEnabled(false);
      setError('');
      onPendingChange(true);
      setReload((value) => value + 1);
    }
    window.addEventListener('auth-changed', onAuthChange);
    window.addEventListener('storage', onAuthChange);
    return () => {
      request.current?.abort();
      window.removeEventListener('auth-changed', onAuthChange);
      window.removeEventListener('storage', onAuthChange);
    };
  }, [onPendingChange, onPaymentChange]);

  async function act(create: boolean) {
    if (busy || request.current) return;
    if (!(create ? createCooldown.start() : syncCooldown.start())) return;
    const controller = new AbortController();
    request.current = controller;
    const token = localStorage.getItem('token');
    const current = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    setBusy(true);
    setError('');
    if (create) onPendingChange(true);
    try {
      let next: ZaloPayPayment;
      if (create) {
        const storageKey = `brewlite-zalopay-${order.id}-${method}`;
        const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
        sessionStorage.setItem(storageKey, key);
        next = await createZaloPay(order.id, method, key);
      } else {
        if (!payment) return;
        next = await syncZaloPay(payment.id, controller.signal);
      }
      if (!current()) return;
      const updated = await getOrder(order.id);
      if (!current()) return;
      publish(next, updated);
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Không thể xử lý thanh toán ZaloPay Sandbox.');
    } finally {
      if (request.current === controller) request.current = null;
      if (current()) setBusy(false);
    }
  }

  async function changeMethod() {
    if (!payment || busy || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const token = localStorage.getItem('token');
    const current = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    setBusy(true);
    setError('');
    try {
      const next = await cancelZaloPay(payment.id, controller.signal);
      const updated = await getOrder(order.id);
      if (current()) publish(next, updated);
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Không thể xác nhận hủy giao dịch.');
    } finally {
      if (request.current === controller) request.current = null;
      if (current()) setBusy(false);
    }
  }

  const active = payment?.status === 'PENDING' || payment?.status === 'SUCCESS';
  const payable = order.status === 'PENDING' || order.status === 'PAYMENT_FAILED';
  return <section aria-labelledby="zalopay-title" className="ticket p-6 sm:p-8">
    <h2 id="zalopay-title" className="flex items-center gap-2 font-display text-lg font-bold"><Wallet size={22} className="text-primary" /> ZaloPay Sandbox</h2>
    <p className="mt-2 text-sm text-content-secondary">Thanh toán thử nghiệm qua cổng ZaloPay. Không dùng tiền thật.</p>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    {(!loaded || error) && <button type="button" disabled={busy || refreshCooldown.blocked} onClick={() => { if (refreshCooldown.start()) setReload((value) => value + 1); }} className="mt-3 min-h-11 font-semibold text-primary disabled:opacity-50">{busy ? 'Đang kiểm tra…' : refreshCooldown.label || 'Tải lại'}</button>}
    {loaded && !enabled && <p className="mt-3 text-sm text-content-secondary">ZaloPay Sandbox chưa được bật hoặc chưa có cấu hình đầy đủ.</p>}
    {payment && <div className="mt-4 space-y-2 rounded-ticket border border-ink/15 bg-paper p-4 text-sm">
      <p className="font-semibold">{payment.reviewReason ? 'Giao dịch cần kiểm tra' : payment.status === 'SUCCESS' ? 'ZaloPay đã xác nhận thành công' : payment.status === 'FAILED' ? 'Giao dịch thất bại hoặc hết hạn' : 'Đang chờ xác nhận từ ZaloPay'}</p>
      <p className="break-all text-xs text-content-secondary">Mã yêu cầu: {payment.providerOrderId}</p>
      {payment.reference && <p className="break-all text-xs text-content-secondary">Mã giao dịch ZaloPay: {payment.reference}</p>}
      {payment.reviewReason && <p className="text-ink">{payment.reviewReason}. Vui lòng liên hệ quản trị viên.</p>}
      {payment.failureReason && <p>{payment.failureReason}</p>}
      {payment.paymentUrl && payment.status === 'PENDING' && enabled && <a href={payment.paymentUrl} className="btn-primary px-4">Tiếp tục thanh toán trên ZaloPay</a>}
      {payment.status === 'PENDING' && enabled && payable && <button type="button" disabled={busy} onClick={() => void changeMethod()} className="btn-outline ml-2 disabled:opacity-50">{busy ? 'Đang kiểm tra…' : 'Đổi phương thức thanh toán'}</button>}
      {!payment.paymentUrl && payment.status === 'PENDING' && <p className="text-sm">Chưa nhận được liên kết thanh toán. Hãy chọn Kiểm tra kết quả trước khi thử lại.</p>}
      {enabled && <button type="button" disabled={busy || syncCooldown.blocked} onClick={() => void act(false)} className="ml-2 min-h-11 px-2 font-semibold text-primary disabled:opacity-50">{busy ? 'Đang kiểm tra…' : syncCooldown.label || 'Kiểm tra kết quả'}</button>}
      {payment.status === 'PENDING' && <p className="text-xs text-content-secondary">Trạng thái tự cập nhật mỗi 15 giây khi mở trang và khi quay lại tab. Chọn “Kiểm tra kết quả” để truy vấn ZaloPay nếu chưa nhận được xác nhận.</p>}
    </div>}
    {loaded && enabled && payable && !active && <div className="mt-4 space-y-3">
      <label className="block text-sm font-semibold">Phương thức sandbox<select value={method} disabled={busy} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="field mt-2"><option value="E_WALLET">Ví ZaloPay</option><option value="BANK_CARD">Thẻ nội địa</option></select></label>
      <button type="button" disabled={busy || createCooldown.blocked} onClick={() => void act(true)} className="btn-primary w-full disabled:opacity-50">{busy ? 'Đang tạo giao dịch…' : createCooldown.label || 'Tạo thanh toán ZaloPay Sandbox'}</button>
    </div>}
  </section>;
}
