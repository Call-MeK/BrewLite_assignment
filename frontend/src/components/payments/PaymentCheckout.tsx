'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  clearPaidCart, createPayment, getPayment, getPaymentAttemptKey, getPaymentOrder,
  Payment, PaymentMethod, PaymentOrder,
} from '@/lib/payments';

export function PaymentCheckout({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('E_WALLET');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);

  function acceptPayment(payment: Payment) {
    setOrder(current => current ? {
      ...current, payment,
      status: payment.status === 'SUCCESS' ? 'PAID' : payment.status === 'FAILED' ? 'PAYMENT_FAILED' : current.status,
    } : current);
    if (payment.status === 'SUCCESS') {
      try { clearPaidCart(window.localStorage, payment); } catch {
        // Browser storage access must not hide a confirmed payment.
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const current = await getPaymentOrder(orderId);
        if (cancelled) return;
        setOrder(current);
        if (current.payment) {
          setMethod(current.payment.method);
          const payment = current.payment.status === 'PENDING'
            ? await getPayment(current.payment.id) : current.payment;
          if (!cancelled) acceptPayment(payment);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không tải được thông tin thanh toán');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [orderId]);

  async function checkPayment() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const current = await getPaymentOrder(orderId);
      setOrder(current);
      if (current.payment) acceptPayment(await getPayment(current.payment.id));
      setUncertain(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa kiểm tra được kết quả');
    } finally {
      setLoading(false);
    }
  }

  async function pay() {
    if (loading || !order) return;
    setLoading(true);
    setError(null);
    try {
      const key = getPaymentAttemptKey(window.sessionStorage, `${orderId}:${method}`, order.payment?.status === 'FAILED');
      const payment = await createPayment(orderId, method, key);
      acceptPayment(payment);
      if (payment.status === 'PENDING' && payment.paymentUrl) window.location.assign(payment.paymentUrl);
    } catch (cause) {
      setUncertain(true);
      setError(cause instanceof Error ? cause.message : 'Không gửi được yêu cầu thanh toán');
    } finally {
      setLoading(false);
    }
  }

  const payment = order?.payment;
  const paid = payment?.status === 'SUCCESS' || ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(order?.status ?? '');
  const pending = payment?.status === 'PENDING';
  const canPay = order && ['PENDING', 'PAYMENT_FAILED'].includes(order.status) && !pending && !uncertain && !paid;

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-border-light bg-white p-6 shadow-sm" aria-busy={loading}>
      <p className="text-sm font-semibold text-primary">BrewLite · ZaloPay Sandbox</p>
      <h1 className="mt-2 text-2xl font-bold text-navy">Thanh toán đơn hàng</h1>
      {order ? (
        <div className="my-6 flex items-center justify-between rounded-xl bg-surface-secondary p-4">
          <span>Đơn #{order.orderNumber}</span>
          <strong className="text-xl">{order.finalAmount.toLocaleString('vi-VN')} ₫</strong>
        </div>
      ) : null}

      {error ? <p role="alert" className="my-4 rounded-lg bg-danger-light p-3 text-content-primary">{error}</p> : null}
      {loading ? <p role="status" className="my-4 text-content-secondary">Đang xử lý, vui lòng chờ…</p> : null}

      {paid ? (
        <div role="status" className="rounded-xl bg-success-light p-4">
          <h2 className="font-bold">Thanh toán thành công</h2>
          <p className="mt-1 text-sm">Đơn hàng đã được xác nhận thanh toán.</p>
          {payment?.transactionRef ? <p className="mt-2 break-all text-sm">Mã giao dịch: {payment.transactionRef}</p> : null}
        </div>
      ) : (
        <>
          {payment?.status === 'FAILED' ? (
            <p role="status" className="mb-4 rounded-lg bg-danger-light p-3">
              {payment.failureReason ?? 'Thanh toán chưa thành công. Bạn có thể thử lại.'}
            </p>
          ) : null}
          {pending || uncertain ? (
            <div role="status" className="my-4 rounded-xl bg-primary-light p-4 text-sm">
              <p>Giao dịch đang chờ xác nhận. Hãy kiểm tra kết quả trước khi thanh toán lại.</p>
              {payment?.failureReason ? <p className="mt-2">{payment.failureReason}</p> : null}
              {payment?.paymentUrl ? (
                <a className="mt-3 inline-block font-semibold text-primary underline" href={payment.paymentUrl}>Tiếp tục trên ZaloPay</a>
              ) : null}
            </div>
          ) : null}
          {canPay ? (
            <>
              <fieldset disabled={loading} className="my-5 space-y-3">
                <legend className="mb-3 font-semibold">Chọn phương thức thanh toán</legend>
                {([
                  ['E_WALLET', 'Ví ZaloPay'], ['BANK_CARD', 'Thẻ Visa / Mastercard / JCB'],
                ] as const).map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-light p-4">
                    <input type="radio" name="paymentMethod" value={value} checked={method === value} onChange={() => setMethod(value)} />
                    {label}
                  </label>
                ))}
              </fieldset>
              <button onClick={pay} disabled={loading} className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                {payment?.status === 'FAILED' ? 'Thử lại thanh toán' : 'Thanh toán qua ZaloPay'}
              </button>
            </>
          ) : null}
          {!canPay && order && !pending && !uncertain ? <p className="my-4">Đơn hàng không ở trạng thái có thể thanh toán.</p> : null}
        </>
      )}

      {!paid ? <button onClick={checkPayment} disabled={loading} className="mt-4 w-full rounded-xl border border-border-light px-5 py-3 font-semibold hover:bg-surface-secondary disabled:opacity-50">Kiểm tra kết quả</button> : null}
      <p className="mt-5 text-xs text-content-secondary">Môi trường thử nghiệm. Sử dụng tài khoản/thẻ sandbox do ZaloPay cung cấp.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-primary underline">Về trang chủ</Link>
    </section>
  );
}
