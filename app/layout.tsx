import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { currentCartId } from "@/lib/cart";
import { cartLines } from "@/lib/orders";
import { STORE_NAME } from "@/lib/store";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: STORE_NAME,
  description: "Small goods, shipped to the US and Canada.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cartId = await currentCartId();
  const count = cartId ? (await cartLines(cartId)).reduce((sum, line) => sum + line.quantity, 0) : 0;

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b bg-panel">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
            <Link href="/" className="shrink-0 font-semibold tracking-tight">{STORE_NAME}</Link>
            <nav className="ml-auto flex shrink-0 gap-6 text-sm text-muted">
              <Link href="/" className="hover:text-ink">Shop</Link>
              <Link href="/account" className="hover:text-ink">Account</Link>
              <Link href="/cart" className="hover:text-ink">Cart{count > 0 && ` (${count})`}</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
