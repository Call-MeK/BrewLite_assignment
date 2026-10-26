'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, QrCode, Wallet, XCircle } from 'lucide-react';
import { finishPaidPendingOrder } from '@/lib/pending-order';
import { getOrder, payOrder, type OrderDetail, type PaymentMethod } from '@/services/order.service';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

function MockQr({ seed }: { seed: string }) {
  const cells = Array.from({ length: 21 * 21 }, (_, index) => {
    const x = index % 21;
    const y = Math.floor(index / 21);
    const finder = (left: number, top: number) => {
      const dx = x - left;
      const dy = y - top;
      if (dx < 0 || dx > 6 || dy < 0 || dy > 6) return null;
      return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
    };
    const marker = finder(0, 0) ?? finder(14, 0) ?? finder(0, 14);
    const value = seed.charCodeAt(index % seed.length) || 7;
    return marker ?? ((x * 17 + y * 31 + value + x * y) % 5 < 2);
  });
  return <div className="mx-auto grid aspect-square w-56 grid-cols-[repeat(21,minmax(0,1fr))] border-[10px] border-white bg-white shadow-sm" role="img" aria-label="Mã QR mô phỏng, không dùng để thanh toán thật">{cells.map((filled, index) => <span key={index} className={filled ? 'bg-navy' : 'bg-white'} />)}</div>;
}

export default function PaymentGatewayPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('E_WALLET');
  const [stage, setStage] = useState<'method' | 'qr' | 'result'>('method');
  const [result, setResult] = useState<'SUCCESS' | 'FAILED' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getOrder(id).then((value) => {
      if (!active) return;
      setOrder(value);
      if (value.status === 'PAID' && localStorage.getItem('brewlite-pending-order-id') === value.id) {
        finishPaidPendingOrder(localStorage, value.id);
        window.dispatchEvent(new Event('cart-changed'));
      }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải đơn hàng.');
    });
    return () => { active = false; };
  }, [id]);

  async function simulate(outcome: 'SUCCESS' | 'FAILED') {
    if (!order || busy) return;
    setBusy(true);
    setError('');
    const storageKey = `brewlite-payment-${order.id}-${method}-${outcome}`;
    try {
      const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      const payment = await payOrder(order.id, method, key, outcome);
      sessionStorage.removeItem(storageKey);
      setResult(payment.status);
      setStage('result');
      if (payment.status === 'SUCCESS' && localStorage.getItem('brewlite-pending-order-id') === order.id) {
        finishPaidPendingOrder(localStorage, order.id);
        window.dispatchEvent(new Event('cart-changed'));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể mô phỏng thanh toán.');
    } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-2xl space-y-6">
    <Link href={`/orders/${id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={17} /> Chi tiết đơn hàng</Link>
    <div className="rounded-[2rem] bg-navy p-7 text-white sm:p-10"><p className="text-sm font-bold uppercase tracking-[0.2em] text-coffee-cream">Bước 3 / 3 · Cổng thanh toán mô phỏng</p><h1 className="mt-3 text-3xl font-black">Thanh toán đơn hàng</h1><p className="mt-3 text-[#f0e3d8]">Không có giao dịch tiền thật.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!order && !error && <p role="status" className="rounded-2xl bg-white p-6 text-content-secondary">Đang tải đơn hàng...</p>}
    {order && <div className="rounded-2xl border border-border-light bg-white p-6 sm:p-8">
      <div className="flex flex-wrap justify-between gap-3 border-b border-border-light pb-5"><div><p className="text-sm text-content-secondary">Đơn #{order.orderNumber}</p><p className="mt-1 text-xl font-black text-navy">{money(order.finalAmount)}</p></div><span className="self-start rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">MOCK PAYMENT</span></div>
      {order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED' ? <div className="py-7 text-center"><p className="font-semibold text-navy">Đơn hàng này không còn chờ thanh toán.</p><Link href={`/orders/${id}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-bold text-white">Xem chi tiết đơn</Link></div> : stage === 'method' ? <div className="pt-6"><h2 className="text-lg font-bold text-navy">Chọn phương thức</h2><div className="mt-4 space-y-3">
        <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-4 ${method === 'E_WALLET' ? 'border-primary bg-primary-light' : 'border-border-light'}`}><input type="radio" name="method" checked={method === 'E_WALLET'} onChange={() => setMethod('E_WALLET')} className="accent-primary" /><Wallet size={22} className="text-primary" /><span className="font-semibold text-navy">Ví điện tử</span></label>
        <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-4 ${method === 'BANK_CARD' ? 'border-primary bg-primary-light' : 'border-border-light'}`}><input type="radio" name="method" checked={method === 'BANK_CARD'} onChange={() => setMethod('BANK_CARD')} className="accent-primary" /><CreditCard size={22} className="text-primary" /><span className="font-semibold text-navy">Thẻ nội địa</span></label>
      </div><button type="button" onClick={() => setStage('qr')} className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-bold text-white hover:bg-primary-hover">Xác nhận thanh toán</button></div> : stage === 'qr' ? <div className="pt-6 text-center"><QrCode className="mx-auto text-primary" size={26} aria-hidden="true" /><h2 className="mt-2 text-xl font-bold text-navy">Quét mã QR mô phỏng</h2><p className="mt-1 text-sm text-content-secondary">{method === 'E_WALLET' ? 'Ví điện tử' : 'Thẻ nội địa'} · {money(order.finalAmount)}</p><div className="mt-5"><MockQr seed={`${order.id}-${method}`} /></div><p className="mt-4 text-sm font-medium text-red-700">QR giả lập, không thể dùng để chuyển tiền.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => void simulate('SUCCESS')} disabled={busy} className="min-h-12 rounded-xl bg-success px-4 font-bold text-white disabled:opacity-50">{busy ? 'Đang xử lý...' : 'Mô phỏng thành công'}</button><button type="button" onClick={() => void simulate('FAILED')} disabled={busy} className="min-h-12 rounded-xl border border-red-300 px-4 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Mô phỏng thất bại</button></div><button type="button" onClick={() => setStage('method')} disabled={busy} className="mt-4 min-h-11 font-semibold text-primary hover:underline">Đổi phương thức</button></div> : <div className="py-8 text-center">{result === 'SUCCESS' ? <CheckCircle2 size={54} className="mx-auto text-success" /> : <XCircle size={54} className="mx-auto text-red-700" />}<h2 className="mt-4 text-2xl font-black text-navy">{result === 'SUCCESS' ? 'Thanh toán mô phỏng thành công' : 'Thanh toán mô phỏng thất bại'}</h2><p className="mt-2 text-sm text-content-secondary">{result === 'SUCCESS' ? 'Đơn hàng đã được ghi nhận.' : 'Bạn có thể thử lại hoặc hủy đơn để nhận lại điểm đã dùng.'}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href={`/orders/${id}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-bold text-white">Xem đơn hàng</Link>{result === 'FAILED' && <button type="button" onClick={() => { setResult(null); setStage('method'); }} className="min-h-11 rounded-xl border border-border-light px-5 font-bold text-navy">Thử lại</button>}</div></div>}
    </div>}
  </section>;
}
