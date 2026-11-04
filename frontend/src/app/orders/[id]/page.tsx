'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { clearPendingOrder } from '@/lib/pending-order';
import { cancelOrder, getOrder, orderStatusLabel, type OrderDetail } from '@/services/order.service';
import { useRequestCooldown } from '@/components/use-request-cooldown';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const cooldown = useRequestCooldown('POST', `/orders/${id}/cancel`);
  const retryCooldown = useRequestCooldown('GET', `/orders/${id}`);
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
    if (!order || busy || cooldown.blocked || !window.confirm(order.status === 'PAID' ? 'Hủy đơn đã thanh toán? Tiền cần được hoàn thủ công; điểm đã dùng sẽ được trả lại và điểm đã thưởng sẽ bị thu hồi.' : 'Bạn muốn hủy đơn hàng này? Điểm đã dùng sẽ được trả lại.') || !cooldown.start()) return;
    setBusy(true);
    setError('');
    try {
      const result = await cancelOrder(order.id);
      setOrder((current) => current ? { ...current, status: result.status } : current);
      if (result.status === 'CANCELLED') {
        clearPendingOrder(localStorage, order.id);
        await loadOrder();
      }
      setMessage('Đã hủy đơn hàng.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 409) {
        await loadOrder();
        setError('Trạng thái đơn hàng đã thay đổi. Vui lòng kiểm tra lại trước khi tiếp tục.');
      } else setError(cause instanceof Error ? cause.message : 'Không thể hủy đơn hàng.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="mx-auto max-w-4xl space-y-6">
    <Link href="/orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={17} aria-hidden="true" /> Tất cả đơn hàng</Link>
    {unauthorized ? <div className="ticket p-8 text-center">
      <h1 className="text-2xl font-extrabold text-navy">Đăng nhập để xem đơn hàng</h1>
      <Link href="/login?next=%2Forders" className="btn-primary mt-5">Đăng nhập</Link>
    </div> : loading ? <p role="status" className="ticket p-8 text-content-secondary">Đang tải đơn hàng...</p> : !order ? <div className="rounded-ticket border-l-4 border-danger bg-danger-light p-6 text-danger" role="alert">
      {error || 'Không tìm thấy đơn hàng.'} <button type="button" disabled={retryCooldown.blocked} onClick={() => { if (retryCooldown.start()) void loadOrder(); }} className="ml-2 font-semibold underline">{retryCooldown.label || 'Thử lại'}</button>
    </div> : <>
      <header className="border-b-[1.5px] border-ink pb-4">
        <p className="kicker">Chi tiết đơn hàng</p>
        <h1 className="price mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Đơn #{order.orderNumber}</h1>
        <p className="mt-2 text-sm text-content-secondary">{date(order.createdAt)}, {orderStatusLabel[order.status] ?? order.status}</p>
      </header>
      {order.refundStatus === 'MANUAL_REQUIRED' && <p className="rounded-ticket border-l-4 border-accent bg-accent-soft p-4 text-ink">Đơn đã hủy và cần hoàn tiền thủ công. Giao dịch mock chỉ là tiền mô phỏng.</p>}
      {message && <p role="status" className="rounded-ticket border-l-4 border-success bg-success-light p-4 font-medium text-success">{message}</p>}
      {error && <p role="alert" className="rounded-ticket border-l-4 border-danger bg-danger-light p-4 font-medium text-danger">{error}</p>}
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="ticket h-fit p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold text-navy">Các món đã chọn</h2>
          <div className="mt-4 divide-y divide-dashed divide-ink/15">
            {order.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-4">
              <div>
                <h3 className="font-semibold text-navy">{item.name}</h3>
                <p className="mt-1 text-sm text-content-secondary">Size {item.size}, {item.quantity} ly</p>
                {item.toppings.length > 0 && <p className="mt-1 text-sm text-content-secondary">Topping: {item.toppings.map((topping) => topping.name).join(', ')}</p>}
              </div>
              <p className="price shrink-0 font-bold text-navy">{money(item.lineTotal)}</p>
            </div>)}</div>
        </div>
        <aside className="ticket h-fit p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold text-navy">Thanh toán</h2>
          <div className="mt-4 space-y-2 text-sm">
            <p className="flex justify-between gap-3 text-content-secondary"><span>Tạm tính</span><span className="price">{money(order.totalAmount)}</span></p>
            {order.discountAmount > 0 && <p className="flex justify-between gap-3 text-content-secondary"><span>Mã giảm giá</span><span className="price">-{money(order.discountAmount)}</span></p>}
            {order.pointsRedeemed > 0 && <p className="flex justify-between gap-3 text-content-secondary"><span>Dùng {order.pointsRedeemed} điểm</span><span className="price">-{money(order.pointsDiscountAmount)}</span></p>}
            <p className="flex items-baseline justify-between gap-3 border-t-[1.5px] border-ink pt-3 text-base font-bold text-navy"><span>Tổng cộng</span><span className="price font-display text-xl font-extrabold text-primary">{money(order.finalAmount)}</span></p>
          </div>
          {order.status === 'CANCELLED' && order.pointsRedeemed > 0 && <p className="mt-3 text-sm text-success">{order.pointsRedeemed} điểm đã được hoàn vào tài khoản.</p>}
          {(order.status === 'PENDING' || order.status === 'PAYMENT_FAILED') && <div className="mt-6 border-t border-dashed border-ink/25 pt-5">
            <p className="text-sm text-content-secondary">Chọn Mock Payment hoặc ZaloPay Sandbox để thanh toán thử nghiệm.</p>
            <Link href={`/orders/${order.id}/payment`} className="btn-primary mt-4 w-full"><CreditCard size={18} aria-hidden="true" /> Đến cổng thanh toán</Link>
          </div>}
          {['PENDING', 'PAYMENT_FAILED', 'PAID'].includes(order.status) && <div className="mt-4">
            {order.status === 'PAID' && <p className="text-sm text-content-secondary">Bạn có thể hủy trước khi quán bắt đầu pha chế. Tiền cần được hoàn thủ công; điểm đã dùng được trả lại và điểm đã thưởng bị thu hồi.</p>}
            <button type="button" onClick={() => void handleCancel()} disabled={busy || cooldown.blocked} className="mt-3 min-h-11 w-full font-semibold text-danger hover:underline disabled:opacity-60">{cooldown.label || 'Hủy đơn hàng'}</button>
          </div>}
        </aside>
      </div>
    </>}
  </section>;
}
