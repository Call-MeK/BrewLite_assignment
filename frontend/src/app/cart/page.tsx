'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Coffee, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { CartItemDraft } from '@/types/product';

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export default function CartPage() {
  const [items, setItems] = useState<CartItemDraft[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('brewlite-cart');
      const parsed = saved ? JSON.parse(saved) : [];
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, []);

  function save(next: CartItemDraft[]) {
    setItems(next);
    localStorage.setItem('brewlite-cart', JSON.stringify(next));
  }

  const total = items.reduce((sum, item) => sum + item.estimatedUnitPrice * item.quantity, 0);

  if (!ready) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-slate-200" /><div className="h-24 rounded-2xl bg-slate-100" /></div>;

  return <section className="mx-auto max-w-4xl space-y-6">
    <Link href="/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-primary"><ArrowLeft size={17} /> Tiếp tục chọn món</Link>
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">BrewLite</p><h1 className="mt-2 text-3xl font-black text-navy">Giỏ hàng của bạn</h1></div>
      <ShoppingBag size={32} className="text-primary" />
    </div>

    {items.length === 0 ? <div className="rounded-3xl border border-border-light bg-white p-10 text-center shadow-sm"><Coffee className="mx-auto mb-4 text-primary" size={42} /><h2 className="text-xl font-bold text-navy">Giỏ hàng đang trống</h2><p className="mt-2 text-sm text-content-secondary">Chọn một món trong thực đơn để bắt đầu nhé.</p><Link href="/menu" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white">Khám phá thực đơn</Link></div> :
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {items.map((item, index) => <article key={`${item.productId}-${item.size}-${item.toppingIds.join('-')}`} className="flex gap-4 rounded-2xl border border-border-light bg-white p-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f5f0e8]">{item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" /> : <Coffee className="text-[#a77b50]" size={30} />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-navy">{item.productName}</h2><button onClick={() => save(items.filter((_, i) => i !== index))} aria-label={`Xóa ${item.productName}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button></div>
              <p className="mt-1 text-sm text-content-secondary">Size {item.size}{item.toppingNames.length ? ` · ${item.toppingNames.join(', ')}` : ''}</p>
              <p className="mt-2 font-bold text-primary">{money(item.estimatedUnitPrice)}</p>
              <div className="mt-3 flex items-center gap-3"><button aria-label="Giảm số lượng" disabled={item.quantity <= 1} onClick={() => save(items.map((x, i) => i === index ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} className="rounded-lg border border-border-light p-1.5 disabled:opacity-40"><Minus size={14} /></button><span className="min-w-5 text-center text-sm font-bold">{item.quantity}</span><button aria-label="Tăng số lượng" disabled={item.quantity >= 99} onClick={() => save(items.map((x, i) => i === index ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x))} className="rounded-lg border border-border-light p-1.5 disabled:opacity-40"><Plus size={14} /></button><span className="ml-auto text-sm font-bold text-navy">{money(item.estimatedUnitPrice * item.quantity)}</span></div>
            </div>
          </article>)}
          <button onClick={() => save([])} className="text-sm font-semibold text-red-600 hover:underline">Xóa toàn bộ giỏ hàng</button>
        </div>
        <aside className="h-fit rounded-2xl border border-border-light bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-navy">Tóm tắt đơn hàng</h2>
          <div className="mt-4 flex justify-between text-sm text-content-secondary"><span>Số loại món</span><span>{items.length}</span></div>
          <div className="mt-3 flex justify-between gap-3 border-t border-border-light pt-4"><span className="font-semibold text-navy">Tạm tính</span><span className="text-xl font-black text-primary">{money(total)}</span></div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Đây là giỏ hàng giao diện cho luồng Product Detail. Chưa thực hiện checkout, tạo đơn hàng hoặc thanh toán.</p>
          <Link href="/menu" className="mt-5 flex justify-center rounded-xl bg-primary px-4 py-3 font-bold text-white">Chọn thêm món</Link>
        </aside>
      </div>}
  </section>;
}
