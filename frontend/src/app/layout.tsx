import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { AuthNav } from '@/components/auth-nav';
import { CartPopover } from '@/components/cart-popover';
import { Coffee } from 'lucide-react';

export const metadata: Metadata = {
  title: 'BrewLite - Đặt Cà Phê Không Dùng Tiền Mặt',
  description: 'Ứng dụng đặt và thanh toán đồ uống không dùng tiền mặt',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen flex flex-col bg-[#fcf8f3] text-content-primary antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-navy">Bỏ qua điều hướng</a>
        <header className="sticky top-0 z-50 border-b border-border-light bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-xl font-black tracking-tight text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><Coffee size={21} aria-hidden="true" /></span>
              BrewLite
            </Link>
            <nav aria-label="Điều hướng chính" className="order-3 flex w-full items-center gap-1 overflow-x-auto text-sm font-semibold lg:order-2 lg:w-auto">
              <Link href="/" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-content-secondary transition-colors hover:bg-primary-light hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                Trang chủ
              </Link>
              <Link href="/menu" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-content-secondary transition-colors hover:bg-primary-light hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                Thực đơn
              </Link>
              <Link href="/orders" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-content-secondary transition-colors hover:bg-primary-light hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                Lịch sử đơn hàng
              </Link>
            </nav>
            <div className="order-2 flex items-center gap-3 lg:order-3"><CartPopover /><AuthNav /></div>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>

        <footer className="border-t border-border-light bg-white py-6 text-center text-sm text-content-secondary">
          BrewLite © 2026 · Cà phê theo cách của bạn
        </footer>
      </body>
    </html>
  );
}
