import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

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
      <body className="min-h-screen flex flex-col bg-surface text-content-primary antialiased">
        {/* Header / Navbar chuẩn bảng màu Obsidian Navy & BrewLite Blue */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border-light shadow-sm">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-black text-navy tracking-tight">☕ BrewLite</span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link href="/menu" className="text-content-secondary hover:text-primary transition">
                Thực đơn
              </Link>
              <Link href="/cart" className="text-content-secondary hover:text-primary transition">
                Giỏ hàng
              </Link>
              <Link href="/orders" className="text-content-secondary hover:text-primary transition">
                Đơn hàng
              </Link>
            </nav>
          </div>
        </header>

        {/* Nội dung chính */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border-light py-6 text-center text-xs text-content-secondary bg-surface-secondary">
          BrewLite © 2026 – Đồ án Công nghệ Phần mềm
        </footer>
      </body>
    </html>
  );
}
