'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { getOrders, orderStatusLabel, type OrderSummary } from '@/services/order.service';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function OrdersPage() {
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
    <div className="rounded-[2rem] bg-navy p-7 text-white sm:p-10">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-coffee-cream">Tài khoản BrewLite</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Đơn hàng của bạn</h1>
      <p className="mt-3 text-[#f0e3d8]">Theo dõi những ly nước bạn đã đặt và trạng thái hiện tại.</p>
    </div>

    {unauthorized ? <div className="rounded-2xl border border-border-light bg-white p-8 text-center">
      <p className="text-content-secondary">Đăng nhập để xem đơn hàng của bạn.</p>
      <Link href="/login?next=%2Forders" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white">Đăng nhập</Link>
    </div> : loading ? <p role="status" className="rounded-2xl bg-white p-8 text-content-secondary">Đang tải đơn hàng...</p> : error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">{error}<button type="button" onClick={() => window.location.reload()} className="ml-2 font-semibold underline">Thử lại</button></div> : orders.length === 0 ? <div className="rounded-2xl border border-border-light bg-white p-10 text-center">
      <ClipboardList size={38} className="mx-auto text-primary" aria-hidden="true" />
      <h2 className="mt-4 text-xl font-bold text-navy">Chưa có đơn hàng</h2>
      <p className="mt-2 text-content-secondary">Chọn món trong thực đơn để bắt đầu nhé.</p>
      <Link href="/menu" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white">Khám phá thực đơn</Link>
    </div> : <>
      <div className="space-y-3">
        {orders.map((order) => <Link key={order.id} href={`/orders/${order.id}`} className="flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-border-light bg-white p-5 shadow-sm transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <div>
            <p className="font-bold text-navy">Đơn #{order.orderNumber}</p>
            <p className="mt-1 text-sm text-content-secondary">{date(order.createdAt)} · {order.itemCount} món</p>
            <p className="mt-2 text-sm font-semibold text-primary">{orderStatusLabel[order.status] ?? order.status}</p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <span className="font-bold text-navy">{money(order.finalAmount)}</span>
            <ArrowRight size={18} className="text-primary" aria-hidden="true" />
          </div>
        </Link>)}
      </div>
      <div className="flex justify-between gap-3">
        <button type="button" disabled={page === 1} onClick={() => { setLoading(true); setError(''); setPage(page - 1); }} className="min-h-11 rounded-xl border border-border-light bg-white px-4 font-semibold text-navy disabled:opacity-40">Trang trước</button>
        <span className="self-center text-sm text-content-secondary">Trang {page}</span>
        <button type="button" disabled={!hasNextPage} onClick={() => { setLoading(true); setError(''); setPage(page + 1); }} className="min-h-11 rounded-xl border border-border-light bg-white px-4 font-semibold text-navy disabled:opacity-40">Trang sau</button>
      </div>
    </>}
  </section>;
}
