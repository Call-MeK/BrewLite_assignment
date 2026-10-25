'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coffee, Minus, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { CartItemDraft } from '@/types/product';
import { ProductPurchaseModal } from '@/components/menu/product-purchase-modal';

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItemDraft[]>([]);
  const [ready, setReady] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    window.dispatchEvent(new Event('cart-changed'));
  }

  const total = items.reduce((sum, item) => sum + item.estimatedUnitPrice * item.quantity, 0);

  if (!ready) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-slate-200" /><div className="h-24 rounded-2xl bg-slate-100" /></div>;

  return <section className="mx-auto max-w-4xl space-y-6">
    <Link href="/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-primary"><ArrowLeft size={17} /> Tiếp tục chọn món</Link>
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Bước 1 / 3</p><h1 className="mt-2 text-3xl font-black text-navy">Xác nhận món</h1></div>
      <ShoppingBag size={32} className="text-primary" />
    </div>

    {items.length === 0 ? <div className="rounded-3xl border border-border-light bg-white p-10 text-center shadow-sm"><Coffee className="mx-auto mb-4 text-primary" size={42} /><h2 className="text-xl font-bold text-navy">Chưa có món nào</h2><p className="mt-2 text-sm text-content-secondary">Chọn một món trong thực đơn để bắt đầu nhé.</p><Link href="/menu" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white">Khám phá thực đơn</Link></div> :
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {items.map((item, index) => <article key={`${item.productId}-${item.size}-${item.toppingIds.join('-')}`} className="flex gap-4 rounded-2xl border border-border-light bg-white p-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f5f0e8]">{item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" /> : <Coffee className="text-[#a77b50]" size={30} />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-navy">{item.productName}</h2><div className="flex shrink-0"><button type="button" onClick={() => setEditingIndex(index)} aria-label={`Sửa ${item.productName}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-primary-light"><Pencil size={17} /></button><button type="button" onClick={() => save(items.filter((_, i) => i !== index))} aria-label={`Xóa ${item.productName}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-red-50 hover:text-red-700"><Trash2 size={17} /></button></div></div>
              <p className="mt-1 text-sm text-content-secondary">Size {item.size}{item.toppingNames.length ? ` · ${item.toppingNames.join(', ')}` : ''}</p>
              <p className="mt-2 font-bold text-primary">{money(item.estimatedUnitPrice)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2"><button aria-label="Giảm số lượng" disabled={item.quantity <= 1} onClick={() => save(items.map((x, i) => i === index ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-light disabled:opacity-40"><Minus size={14} /></button><span className="min-w-5 text-center text-sm font-bold">{item.quantity}</span><button aria-label="Tăng số lượng" disabled={item.quantity >= 99} onClick={() => save(items.map((x, i) => i === index ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-light disabled:opacity-40"><Plus size={14} /></button><span className="w-full text-right text-sm font-bold text-navy sm:ml-auto sm:w-auto">{money(item.estimatedUnitPrice * item.quantity)}</span></div>
            </div>
          </article>)}
          <button onClick={() => save([])} className="text-sm font-semibold text-red-600 hover:underline">Xóa tất cả món đã chọn</button>
        </div>
        <aside className="h-fit rounded-2xl border border-border-light bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-navy">Tóm tắt đơn hàng</h2>
          <div className="mt-4 flex justify-between text-sm text-content-secondary"><span>Số loại món</span><span>{items.length}</span></div>
          <div className="mt-3 flex justify-between gap-3 border-t border-border-light pt-4"><span className="font-semibold text-navy">Tạm tính</span><span className="text-xl font-black text-primary">{money(total)}</span></div>
          <p className="mt-4 text-xs leading-5 text-content-secondary">Kiểm tra lại món và số lượng trước khi tiếp tục. Bạn sẽ dùng điểm tích lũy ở bước sau.</p>
          <button type="button" onClick={() => router.push('/checkout')} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 py-3 font-bold text-white hover:bg-primary-hover">
            Tiến hành thanh toán
          </button>
          <Link href="/menu" className="mt-3 flex min-h-11 items-center justify-center font-semibold text-primary hover:underline">Chọn thêm món</Link>
        </aside>
      </div>}
    {editingIndex !== null && items[editingIndex] && <ProductPurchaseModal key={`${items[editingIndex].productId}-${editingIndex}`} productId={items[editingIndex].productId} initialItem={items[editingIndex]} editingIndex={editingIndex} onClose={() => setEditingIndex(null)} onSaved={() => {
      const saved = JSON.parse(localStorage.getItem('brewlite-cart') || '[]');
      setItems(Array.isArray(saved) ? saved : []);
      setEditingIndex(null);
    }} />}
  </section>;
}
