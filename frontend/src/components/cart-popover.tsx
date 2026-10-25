'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import type { CartItemDraft } from '@/types/product';

export function CartPopover() {
  const [items, setItems] = useState<CartItemDraft[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const value = JSON.parse(localStorage.getItem('brewlite-cart') || '[]');
        setItems(Array.isArray(value) ? value : []);
      } catch { setItems([]); }
    };
    load();
    window.addEventListener('storage', load);
    window.addEventListener('cart-changed', load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener('cart-changed', load);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return <div className="relative shrink-0">
    <button type="button" onClick={() => setOpen(!open)} aria-label={`Túi món, ${count} món`} aria-expanded={open} aria-controls="cart-popover" aria-haspopup="dialog" className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border-light bg-white text-primary hover:bg-primary-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <ShoppingBag size={20} aria-hidden="true" />
      {count > 0 && <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white" aria-hidden="true">{count}</span>}
    </button>
    {open && <><button type="button" tabIndex={-1} aria-label="Đóng túi món" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-transparent" /><div id="cart-popover" role="dialog" aria-label="Món đã chọn" className="fixed right-4 top-20 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border-light bg-white p-5 shadow-xl lg:absolute lg:right-0 lg:top-14">
      <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-navy">Món đã chọn · {count} ly</h2><button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="flex h-11 w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-primary-light"><X size={18} /></button></div>
      {items.length === 0 ? <p className="mt-3 text-sm text-content-secondary">Bạn chưa chọn món nào.</p> : <div className="mt-2 max-h-72 divide-y divide-border-light overflow-y-auto">{items.map((item) => <div key={`${item.productId}-${item.size}-${item.toppingIds.join('-')}`} className="py-3 text-sm"><p className="font-semibold text-navy">{item.productName} <span className="text-primary">× {item.quantity}</span></p><p className="mt-1 text-content-secondary">Size {item.size}{item.toppingNames.length ? ` · ${item.toppingNames.join(', ')}` : ''}</p></div>)}</div>}
      <Link href={items.length ? '/cart' : '/menu'} onClick={() => setOpen(false)} className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-bold text-white hover:bg-primary-hover">{items.length ? 'Xác nhận món' : 'Xem thực đơn'}</Link>
    </div></>}
  </div>;
}
