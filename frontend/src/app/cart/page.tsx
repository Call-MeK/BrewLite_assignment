'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coffee, Minus, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { resolveProductImageByName } from '@/lib/local-product-images';
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
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!ready) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-paper-deep" /><div className="h-28 rounded-ticket border border-ink/10 bg-white" /></div>;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <Link href="/menu" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-content-secondary hover:text-primary">
        <ArrowLeft size={17} aria-hidden="true" /> Tiếp tục chọn món
      </Link>

      <header className="flex items-end justify-between gap-4 border-b-[1.5px] border-ink pb-4">
        <div>
          <p className="kicker">Bước 1 / 3</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Xác nhận món</h1>
        </div>
        <p className="price shrink-0 text-sm font-semibold text-content-secondary">{count} ly</p>
      </header>

      {items.length === 0 ? (
        <div className="ticket p-10 text-center">
          <Coffee className="mx-auto mb-4 text-primary" size={40} aria-hidden="true" />
          <h2 className="text-xl font-bold text-ink">Chưa có món nào</h2>
          <p className="mt-2 text-sm leading-6 text-content-secondary">Chọn một món trong thực đơn để bắt đầu nhé.</p>
          <Link href="/menu" className="btn-primary mt-6">Khám phá thực đơn</Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="ticket divide-y divide-dashed divide-ink/20">
              {items.map((item, index) => (
                <article key={`${item.productId}-${item.size}-${item.toppingIds.join('-')}`} className="flex gap-4 p-4 sm:p-5">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-ticket border border-ink/15 bg-paper-deep">
                    <img
                      src={resolveProductImageByName(item.productName, item.imageUrl)}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold text-ink">{item.productName}</h2>
                      <div className="flex shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingIndex(index)}
                          aria-label={`Sửa ${item.productName}`}
                          className="flex h-10 w-10 items-center justify-center rounded-ticket text-primary hover:bg-primary-light"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => save(items.filter((_, i) => i !== index))}
                          aria-label={`Xóa ${item.productName}`}
                          className="flex h-10 w-10 items-center justify-center rounded-ticket text-content-secondary hover:bg-danger-light hover:text-danger"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-1 text-sm text-content-secondary">
                      Size {item.size}{item.toppingNames.length ? `, ${item.toppingNames.join(', ')}` : ''}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        aria-label="Giảm số lượng"
                        disabled={item.quantity <= 1}
                        onClick={() => save(items.map((x, i) => i === index ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}
                        className="flex h-10 w-10 items-center justify-center rounded-ticket border border-ink/20 text-ink disabled:opacity-40"
                      >
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span className="price min-w-6 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        aria-label="Tăng số lượng"
                        disabled={item.quantity >= 99}
                        onClick={() => save(items.map((x, i) => i === index ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x))}
                        className="flex h-10 w-10 items-center justify-center rounded-ticket border border-ink/20 text-ink disabled:opacity-40"
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                      <span className="price ml-auto text-sm font-bold text-ink">
                        {money(item.estimatedUnitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <button onClick={() => save([])} className="mt-3 text-sm font-semibold text-danger hover:underline">
              Xóa tất cả món đã chọn
            </button>
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <div className="ticket p-5">
              <h2 className="font-display text-lg font-bold text-ink">Tóm tắt đơn</h2>
              <div className="mt-4 space-y-2 text-sm">
                <p className="flex justify-between gap-3">
                  <span className="text-content-secondary">Số loại món</span>
                  <span className="price">{items.length}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-content-secondary">Tổng số ly</span>
                  <span className="price">{count}</span>
                </p>
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-3 border-t-[1.5px] border-ink pt-4">
                <span className="font-semibold text-ink">Tạm tính</span>
                <span className="price font-display text-xl font-extrabold text-primary">{money(total)}</span>
              </div>
              <button
                type="button"
                onClick={() => router.push(localStorage.getItem('token') ? '/checkout' : '/login?next=%2Fcheckout')}
                className="btn-primary mt-5 w-full"
              >
                Tiến hành thanh toán
              </button>
              <Link href="/menu" className="mt-3 flex min-h-11 items-center justify-center text-sm font-semibold text-primary hover:underline">
                Chọn thêm món
              </Link>
            </div>
            <p className="mt-3 px-1 text-xs leading-5 text-content-secondary">
              Kiểm tra món và số lượng trước khi tiếp tục. Điểm tích lũy được dùng ở bước sau.
            </p>
          </aside>
        </div>
      )}

      {editingIndex !== null && items[editingIndex] && (
        <ProductPurchaseModal
          key={`${items[editingIndex].productId}-${editingIndex}`}
          productId={items[editingIndex].productId}
          initialItem={items[editingIndex]}
          editingIndex={editingIndex}
          onClose={() => setEditingIndex(null)}
          onSaved={() => {
            const saved = JSON.parse(localStorage.getItem('brewlite-cart') || '[]');
            setItems(Array.isArray(saved) ? saved : []);
            setEditingIndex(null);
          }}
        />
      )}
    </section>
  );
}
