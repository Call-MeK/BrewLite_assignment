import Link from 'next/link';
import { AdminNav } from '@/components/admin-nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-auto bg-paper text-ink md:flex">
    <aside className="border-b-[1.5px] border-ink bg-paper-deep/60 px-4 pb-3 pt-4 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r-[1.5px] md:px-5 md:py-7 md:pb-16">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-ink/15 pb-4 md:mb-6 md:block">
        <div>
          <Link href="/admin" className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">BrewLite</Link>
          <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-content-secondary">Sổ quản trị</p>
        </div>
        <Link href="/" className="text-xs font-semibold text-content-secondary underline decoration-ink/30 decoration-1 underline-offset-4 hover:text-ink hover:decoration-ink md:mt-5 md:inline-block">← Về cửa hàng</Link>
      </div>
      <AdminNav />
      <p className="mt-auto hidden pt-6 text-[0.68rem] leading-5 text-content-secondary md:block">Dữ liệu vận hành lấy trực tiếp từ backend BrewLite.</p>
    </aside>
    <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 lg:px-10 lg:py-9">{children}</main>
  </div>;
}
