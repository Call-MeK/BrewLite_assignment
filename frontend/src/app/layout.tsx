import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Archivo, Be_Vietnam_Pro } from "next/font/google";
import { AuthNav } from "@/components/auth-nav";
import { CartPopover } from "@/components/cart-popover";
import { Coffee } from "lucide-react";

const display = Archivo({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BrewLite - Đặt cà phê, nhận tại quầy",
  description: "Chọn đồ uống, tùy chỉnh size và topping, thanh toán ZaloPay và nhận tại quầy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} flex min-h-screen flex-col antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-ticket focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Bỏ qua điều hướng
        </a>

        <header className="sticky top-0 z-50 border-b-[1.5px] border-ink bg-paper/95 backdrop-blur">
          <div className="shell flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-3 rounded-ticket focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-ticket bg-primary text-paper">
                <Coffee size={20} aria-hidden="true" />
              </span>
              <span className="leading-none">
                <span className="block font-display text-xl font-extrabold tracking-[-0.02em] text-ink">
                  BrewLite
                </span>
                <span className="mt-1 block text-[0.7rem] font-medium text-content-secondary">
                  Quán cà phê đặt trước
                </span>
              </span>
            </Link>

            <nav
              aria-label="Điều hướng chính"
              className="order-3 flex w-full items-center gap-6 overflow-x-auto text-sm font-semibold lg:order-2 lg:w-auto"
            >
              {[
                { href: "/", label: "Trang chủ" },
                { href: "/menu", label: "Thực đơn" },
                { href: "/orders", label: "Đơn hàng" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent text-content-secondary transition-colors hover:border-ink hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="order-2 flex items-center gap-3 lg:order-3">
              <CartPopover />
              <AuthNav />
            </div>
          </div>
        </header>

        <main id="main-content" className="shell flex-1 py-8 sm:py-12">
          {children}
        </main>

        <footer className="mt-16 border-t-[1.5px] border-ink">
          <div className="shell flex flex-col gap-6 py-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-display text-lg font-extrabold tracking-[-0.02em]">BrewLite</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-content-secondary">
                Đặt trước ly bạn thích, nhận tại quầy. Thanh toán ZaloPay, không dùng tiền mặt.
              </p>
            </div>
            <div className="text-sm text-content-secondary sm:text-right">
              <p>Ảnh: Unsplash và Wikimedia Commons</p>
              <p className="mt-1">© 2026 BrewLite</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
