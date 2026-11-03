'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNav() {
  const path = usePathname();
  return <nav aria-label="Quản trị" className="flex flex-wrap gap-2 border-b border-border-light pb-4">
    {[['/admin/users', 'Khách hàng & phân quyền'], ['/admin/payments', 'Thanh toán'], ['/admin/recipes', 'Công thức']].map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${path === href ? 'bg-primary text-white' : 'text-content-secondary hover:bg-primary-light'}`}>{label}</Link>)}
  </nav>;
}
