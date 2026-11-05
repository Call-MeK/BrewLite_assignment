'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { getOrders, orderStatusLabel, type OrderSummary } from '@/services/order.service';
import { useRequestCooldown } from '@/components/use-request-cooldown';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function OrdersPage() {
  const cooldown = useRequestCooldown('GET', '/orders/me');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    let active = true;
    getOrders(page).then((result) => {
      if (!active) return;
      setOrders(result.items);
      setHasNextPage(result.pagination.hasNextPage);
      setLoading(false);
    }).catch((cause) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.statusCode === 401) setUnauthorized(true);
      else setError(cause instanceof Error ? cause.message : 'Không thể tải đơn hàng.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [page]);

  return <section className="mx-auto max-w-4xl space-y-6">
    <header className="border-b-[1.5px] border-ink pb-4">
      <p className="kicker">Tài khoản BrewLite</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Đơn hàng của bạn</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Theo dõi những ly nước bạn đã đặt và trạng thái hiện tại.</p>
    </header>

    {unauthorized ? <div className="ticket p-8 text-center">
      <p className="text-content-secondary">Đăng nhập để xem đơn hàng của bạn.</p>
      <Link href="/login?next=%2Forders" className="btn-primary mt-5">Đăng nhập</Link>
    </div> : loading ? <p role="status" className="ticket p-8 text-content-secondary">Đang tải đơn hàng...</p> : error ? <div role="alert" className="rounded-ticket border-l-4 border-danger bg-danger-light p-6 text-danger">{error}<button type="button" disabled={cooldown.blocked} onClick={() => { if (cooldown.start()) window.location.reload(); }} className="ml-2 font-semibold underline">{cooldown.label || 'Thử lại'}</button></div> : orders.length === 0 ? <div className="ticket p-10 text-center">
      <ClipboardList size={38} className="mx-auto text-primary" aria-hidden="true" />
      <h2 className="mt-4 text-xl font-bold text-navy">Chưa có đơn hàng</h2>
      <p className="mt-2 text-content-secondary">Chọn món trong thực đơn để bắt đầu nhé.</p>
      <Link href="/menu" className="btn-primary mt-5">Khám phá thực đơn</Link>
    </div> : <>
      <div className="space-y-3">
        {orders.map((order) => <Link key={order.id} href={['PENDING', 'PAYMENT_FAILED'].includes(order.status) ? `/orders/${order.id}/payment` : `/orders/${order.id}`} className="ticket flex min-h-28 items-center justify-between gap-4 p-5 transition-transform hover:-translate-y-0.5 hover:shadow-ticket-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <div>
            <p className="font-bold text-navy">Đơn #{order.orderNumber}</p>
            <p className="mt-1 text-sm text-content-secondary">{date(order.createdAt)}, {order.itemCount} món</p>
            <p className="mt-2 text-sm font-semibold text-primary">{orderStatusLabel[order.status] ?? order.status}</p>
            {['PENDING', 'PAYMENT_FAILED'].includes(order.status) && <p className="mt-1 text-sm font-semibold text-primary underline">Tiếp tục thanh toán</p>}
          </div>
          <div className="flex items-center gap-3 text-right">
            <span className="price font-bold text-navy">{money(order.finalAmount)}</span>
            <ArrowRight size={18} className="text-primary" aria-hidden="true" />
          </div>
        </Link>)}
      </div>
      <div className="flex justify-between gap-3">
        <button type="button" disabled={page === 1 || cooldown.blocked} onClick={() => { if (cooldown.start()) { setLoading(true); setError(''); setPage(page - 1); } }} className="btn-quiet min-h-11 px-4 disabled:opacity-40">{cooldown.label || 'Trang trước'}</button>
        <span className="self-center text-sm text-content-secondary">Trang {page}</span>
        <button type="button" disabled={!hasNextPage || cooldown.blocked} onClick={() => { if (cooldown.start()) { setLoading(true); setError(''); setPage(page + 1); } }} className="btn-quiet min-h-11 px-4 disabled:opacity-40">{cooldown.label || 'Trang sau'}</button>
      </div>
    </>}
  </section>;
}
