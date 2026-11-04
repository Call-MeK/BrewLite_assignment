'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  ['/admin', 'Tổng quan'], ['/admin/orders', 'Đơn hàng'], ['/admin/products', 'Thực đơn'],
  ['/admin/ingredients', 'Nguyên liệu'], ['/admin/imports', 'Nhập hàng'], ['/admin/recipes', 'Công thức'],
  ['/admin/users', 'Khách hàng'], ['/admin/payments', 'Thanh toán'],
];

export function AdminNav() {
  const path = usePathname();
  return <nav aria-label="Quản trị" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-col md:gap-1 md:overflow-visible md:pb-0">
    {links.map(([href, label], index) => {
      const active = path === href || (href !== '/admin' && path.startsWith(`${href}/`));
      return <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`group flex min-h-11 shrink-0 items-center gap-3 rounded-ticket border px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? 'border-ink bg-ink text-paper' : 'border-transparent text-content-secondary hover:border-ink/25 hover:bg-white/70 hover:text-ink'}`}
      >
        <span className={`text-[0.65rem] font-semibold tabular-nums ${active ? 'text-accent' : 'text-content-secondary/60 group-hover:text-primary'}`}>{String(index + 1).padStart(2, '0')}</span>
        {label}
      </Link>;
    })}
  </nav>;
}
