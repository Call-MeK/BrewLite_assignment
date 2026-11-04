'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { orderStatusLabel, type OrderStatus } from '@/services/order.service';
import { advanceAdminOrder, cancelAdminOrder, getAdminOrder, getAdminOrders, type AdminOrder, type AdminOrderDetail } from '@/services/admin-order.service';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const button = 'inline-flex min-h-11 items-center justify-center rounded-ticket border border-ink/25 bg-white px-4 text-sm font-semibold text-ink hover:border-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40';
const nextStatus: Partial<Record<OrderStatus, 'PREPARING' | 'READY' | 'COMPLETED'>> = { PAID: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' };
const nextLabel = { PREPARING: 'Bắt đầu chuẩn bị', READY: 'Đánh dấu sẵn sàng', COMPLETED: 'Hoàn thành đơn' };
const errorMessage = (error: unknown) => error instanceof ApiError && error.statusCode === 401 ? 'Vui lòng đăng nhập để quản lý đơn hàng.' : error instanceof ApiError && error.statusCode === 403 ? 'Tài khoản không có quyền quản lý đơn hàng.' : error instanceof Error ? error.message : 'Không thể tải đơn hàng. Vui lòng thử lại.';

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('token');
    const isCurrent = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    setLoading(true); setError(''); setOrders([]);
    getAdminOrders(page, status, controller.signal).then((result) => {
      if (!isCurrent()) return;
      setOrders(result.items); setHasNext(result.pagination.hasNextPage); setTotal(result.pagination.total); setLoading(false);
    }).catch((cause) => { if (isCurrent()) { setError(errorMessage(cause)); setLoading(false); } });
    return () => controller.abort();
  }, [page, status, revision]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    const controller = new AbortController();
    const token = localStorage.getItem('token');
    const isCurrent = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    setDetail(null); setDetailError(''); setDetailLoading(true);
    getAdminOrder(selected, controller.signal).then((result) => { if (isCurrent()) { setDetail(result); setDetailLoading(false); } }).catch((cause) => {
      if (isCurrent()) { setDetailError(errorMessage(cause)); setDetailLoading(false); }
    });
    return () => controller.abort();
  }, [selected, revision]);

  async function update(action: 'cancel' | 'advance') {
    if (!detail || busy) return;
    const next = nextStatus[detail.status];
    if (action === 'advance' && !next) return;
    if (action === 'cancel' && !window.confirm(detail.status === 'PAID' ? 'Hủy đơn đã thanh toán? Đơn cần được hoàn tiền thủ công; tiền chưa được hoàn tự động.' : 'Bạn muốn hủy đơn hàng này?')) return;
    const token = localStorage.getItem('token');
    setBusy(true); setNotice(''); setDetailError('');
    try {
      if (action === 'cancel') await cancelAdminOrder(detail.id);
      else if (next) await advanceAdminOrder(detail.id, next);
      if (localStorage.getItem('token') !== token) return;
      setNotice(action === 'cancel' && detail.status === 'PAID' ? 'Đã hủy đơn. Cần hoàn tiền thủ công; tiền chưa được hoàn tự động.' : 'Đã cập nhật đơn hàng.');
      setRevision((value) => value + 1);
    } catch (cause) {
      if (localStorage.getItem('token') !== token) return;
      if (cause instanceof ApiError && cause.statusCode === 409) {
        setNotice('Đơn hàng vừa thay đổi. Đã tải lại trạng thái mới nhất.');
        setRevision((value) => value + 1);
      } else setDetailError(errorMessage(cause));
    } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-6xl space-y-6">
    <header className="border-b-[1.5px] border-ink pb-5">
      <p className="kicker">Sổ quản trị · Đơn hàng</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Đơn hàng</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Theo dõi và xử lý đơn của khách hàng theo từng trạng thái.</p>
        </div>
        {!loading && !error && <span className="rounded-ticket border border-ink/25 bg-white px-3 py-2 text-xs font-semibold text-content-secondary">{total} đơn hàng</span>}
      </div>
    </header>

    <div className="flex flex-wrap items-end justify-between gap-4">
      <label className="block w-full text-xs font-semibold text-content-secondary sm:max-w-60">Lọc theo trạng thái
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setSelected(null); }} className="field mt-2">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(orderStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <p className="text-xs text-content-secondary">Chọn một đơn để xem chi tiết và cập nhật trạng thái.</p>
    </div>

    {notice && <p role="status" className="rounded-ticket border-l-4 border-accent bg-accent-soft/60 p-4 text-sm text-ink">{notice}</p>}
    {error ? <div role="alert" className="rounded-ticket border-l-4 border-danger bg-danger-light p-4 text-danger">{error} {error.includes('đăng nhập') && <Link className="underline" href="/login?next=%2Fadmin%2Forders">Đăng nhập</Link>} <button type="button" className="ml-2 underline" onClick={() => setRevision((value) => value + 1)}>Thử lại</button></div>
      : loading ? <p role="status" className="ticket p-8 text-content-secondary">Đang tải đơn hàng...</p>
        : orders.length === 0 ? <div className="ticket p-10 text-center"><Search size={30} className="mx-auto text-primary" aria-hidden="true" /><p className="mt-3 font-semibold text-ink">Không có đơn hàng phù hợp.</p><p className="mt-1 text-sm text-content-secondary">Thử chọn trạng thái khác.</p></div>
          : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
            <div className="space-y-3">
              {orders.map((order) => <button type="button" key={order.id} onClick={() => { setSelected(order.id); setNotice(''); }} aria-pressed={selected === order.id} className={`ticket w-full p-4 text-left transition-transform hover:-translate-y-0.5 hover:shadow-ticket-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected === order.id ? 'border-primary bg-primary-light/25' : ''}`}>
                <span className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-content-secondary">Đơn hàng</span>
                    <strong className="mt-0.5 block text-lg text-ink">#{order.orderNumber}</strong>
                  </span>
                  <strong className="price text-ink">{money(order.finalAmount)}</strong>
                </span>
                <span className="mt-2 block border-t border-dashed border-ink/20 pt-2 text-sm text-content-secondary">{order.customer.fullName || order.customer.email} · {date(order.createdAt)}</span>
                <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                  {orderStatusLabel[order.status] ?? order.status}
                  {order.refundStatus === 'MANUAL_REQUIRED' && <span className="rounded-ticket bg-accent-soft px-2 py-0.5 text-ink">Cần hoàn tiền thủ công</span>}
                </span>
              </button>)}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button className={button} disabled={page === 1} onClick={() => { setPage(page - 1); setSelected(null); }}>Trang trước</button>
                <span className="text-sm text-content-secondary">Trang {page}</span>
                <button className={button} disabled={!hasNext} onClick={() => { setPage(page + 1); setSelected(null); }}>Trang sau</button>
              </div>
            </div>

            <div className="ticket p-5 sm:p-6 lg:sticky lg:top-6">
              {!selected ? <div className="py-6 text-center"><ReceiptPlaceholder /><p className="mt-3 text-sm text-content-secondary">Chọn một đơn để xem chi tiết.</p></div>
                : detailLoading ? <p role="status" className="text-sm text-content-secondary">Đang tải chi tiết...</p>
                  : detailError && !detail ? <p role="alert" className="text-sm text-danger">{detailError}</p>
                    : detail && <div className="space-y-5">
                      <div className="border-b border-dashed border-ink/25 pb-4">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-content-secondary">Chi tiết đơn</p>
                        <h2 className="mt-1 text-2xl font-bold text-ink">Đơn #{detail.orderNumber}</h2>
                        <p className="mt-1 text-sm text-content-secondary">{detail.customer.fullName || detail.customer.email} · {detail.customer.email}</p>
                        <p className="mt-2 inline-flex rounded-ticket border border-primary/30 bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">{orderStatusLabel[detail.status] ?? detail.status}</p>
                      </div>
                      {detail.refundStatus === 'MANUAL_REQUIRED' && <p className="rounded-ticket border-l-4 border-accent bg-accent-soft/60 p-3 text-sm font-semibold text-ink">Cần hoàn tiền thủ công. Tiền chưa được hoàn tự động.</p>}
                      <div className="space-y-3 border-b border-dashed border-ink/25 pb-4">{detail.items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><div><p className="font-semibold text-ink">{item.quantity} × {item.name} ({item.size})</p>{item.toppings.length > 0 && <p className="text-content-secondary">{item.toppings.map((topping) => topping.name).join(', ')}</p>}</div><span className="price shrink-0">{money(item.lineTotal)}</span></div>)}<div className="flex justify-between gap-3 border-t border-ink/15 pt-3 font-bold"><span>Tổng thanh toán</span><span className="price">{money(detail.finalAmount)}</span></div></div>
                      <div><h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-content-secondary">Thanh toán</h3>{detail.payments.length ? <ul className="mt-2 space-y-2 text-sm text-content-secondary">{detail.payments.map((payment) => <li key={payment.id}>{payment.source} · {payment.status} · {money(payment.amount)}{payment.reviewReason && ` · ${payment.reviewReason}`}</li>)}</ul> : <p className="mt-2 text-sm text-content-secondary">Chưa có giao dịch.</p>}</div>
                      {detail.statusHistory.length > 0 && <div><h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-content-secondary">Lịch sử trạng thái</h3><ul className="mt-2 space-y-2 text-sm text-content-secondary">{detail.statusHistory.map((entry, index) => <li key={`${entry.createdAt}-${index}`}>{date(entry.createdAt)} · {orderStatusLabel[entry.toStatus] ?? entry.toStatus}{entry.reason && ` · ${entry.reason}`}</li>)}</ul></div>}
                      {detailError && <p role="alert" className="text-sm text-danger">{detailError}</p>}
                      <div className="flex flex-wrap gap-2 border-t border-dashed border-ink/25 pt-4">
                        {nextStatus[detail.status] && <button className="btn-primary min-h-11 px-4 text-white disabled:opacity-40" disabled={busy} onClick={() => update('advance')}>{nextLabel[nextStatus[detail.status]!]}</button>}
                        {['PENDING', 'PAYMENT_FAILED', 'PAID'].includes(detail.status) && <button className={`${button} text-danger`} disabled={busy} onClick={() => update('cancel')}>Hủy đơn</button>}
                      </div>
                    </div>}
            </div>
          </div>}
  </section>;
}

function ReceiptPlaceholder() {
  return <svg viewBox="0 0 48 48" className="mx-auto h-12 w-12 text-ink/25" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 6h24v36l-4-3-4 3-4-3-4 3-4-3-4 3V6Z" />
    <path d="M18 15h12M18 22h12M18 29h7" strokeLinecap="round" />
  </svg>;
}
