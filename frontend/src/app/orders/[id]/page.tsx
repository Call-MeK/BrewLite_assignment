'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { clearPendingOrder } from '@/lib/pending-order';
import { cancelOrder, getOrder, orderStatusLabel, type OrderDetail } from '@/services/order.service';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadOrder = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setOrder(await getOrder(id));
      setError('');
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 401) setUnauthorized(true);
      else setError(cause instanceof Error ? cause.message : 'Không thể tải đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  async function handleCancel() {
    if (!order || busy || !window.confirm('Bạn muốn hủy đơn hàng này?')) return;
    setBusy(true);
    setError('');
    try {
      const result = await cancelOrder(order.id);
      setOrder((current) => current ? { ...current, status: result.status } : current);
      if (result.status === 'CANCELLED') clearPendingOrder(localStorage, order.id);
      setMessage('Đã hủy đơn hàng.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể hủy đơn hàng.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="mx-auto max-w-4xl space-y-6">
    <Link href="/orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={17} aria-hidden="true" /> Tất cả đơn hàng</Link>
    {unauthorized ? <div className="rounded-2xl border border-border-light bg-white p-8 text-center">
      <h1 className="text-2xl font-black text-navy">Đăng nhập để xem đơn hàng</h1>
      <Link href="/login?next=%2Forders" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white">Đăng nhập</Link>
    </div> : loading ? <p role="status" className="rounded-2xl bg-white p-8 text-content-secondary">Đang tải đơn hàng...</p> : !order ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800" role="alert">
      {error || 'Không tìm thấy đơn hàng.'} <button type="button" onClick={() => void loadOrder()} className="ml-2 font-semibold underline">Thử lại</button>
    </div> : <>
      <div className="rounded-[2rem] bg-navy p-7 text-white sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-coffee-cream">Chi tiết đơn hàng</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Đơn #{order.orderNumber}</h1>
        <p className="mt-3 text-[#f0e3d8]">{date(order.createdAt)} · {orderStatusLabel[order.status] ?? order.status}</p>
      </div>
      {message && <p role="status" className="rounded-xl bg-success-light p-4 font-medium text-success">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 font-medium text-red-800">{error}</p>}
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-border-light bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold text-navy">Các món đã chọn</h2>
          <div className="mt-4 divide-y divide-border-light">
            {order.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-4">
              <div>
                <h3 className="font-semibold text-navy">{item.name}</h3>
                <p className="mt-1 text-sm text-content-secondary">Size {item.size} · {item.quantity} ly</p>
                {item.toppings.length > 0 && <p className="mt-1 text-sm text-content-secondary">Topping: {item.toppings.map((topping) => topping.name).join(', ')}</p>}
              </div>
              <p className="shrink-0 font-bold text-navy">{money(item.lineTotal)}</p>
            </div>)}
          </div>
        </div>
        <aside className="h-fit rounded-2xl border border-border-light bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold text-navy">Thanh toán</h2>
          <div className="mt-4 space-y-2 text-sm">
            <p className="flex justify-between gap-3 text-content-secondary"><span>Tạm tính</span><span>{money(order.totalAmount)}</span></p>
            {order.discountAmount > 0 && <p className="flex justify-between gap-3 text-content-secondary"><span>Mã giảm giá</span><span>-{money(order.discountAmount)}</span></p>}
            {order.pointsRedeemed > 0 && <p className="flex justify-between gap-3 text-content-secondary"><span>Dùng {order.pointsRedeemed} điểm</span><span>-{money(order.pointsDiscountAmount)}</span></p>}
            <p className="flex justify-between gap-3 border-t border-border-light pt-3 text-base font-bold text-navy"><span>Tổng cộng</span><span>{money(order.finalAmount)}</span></p>
          </div>
          {order.status === 'CANCELLED' && order.pointsRedeemed > 0 && <p className="mt-3 text-sm text-success">{order.pointsRedeemed} điểm đã được hoàn vào tài khoản.</p>}
          {(order.status === 'PENDING' || order.status === 'PAYMENT_FAILED') && <div className="mt-6 border-t border-border-light pt-5">
            <p className="text-sm text-content-secondary">Chọn ví điện tử hoặc thẻ nội địa tại cổng thanh toán mô phỏng.</p>
            <Link href={`/orders/${order.id}/payment`} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-white hover:bg-primary-hover"><CreditCard size={18} aria-hidden="true" /> Đến cổng thanh toán</Link>
            <button type="button" onClick={() => void handleCancel()} disabled={busy} className="mt-3 min-h-11 w-full font-semibold text-red-700 hover:underline disabled:opacity-60">Hủy đơn hàng</button>
          </div>}
        </aside>
      </div>
    </>}
  </section>;
}
