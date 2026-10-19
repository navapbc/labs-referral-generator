/**
 * Root layout component, wraps all pages.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/layout
 */
import type React from "react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { Geist, Geist_Mono } from "next/font/google";
import Layout from "src/components/Layout";
import { defaultLocale, locales } from "src/i18n/config";
import "@/app/globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "Referral Generator",
  description: "AI-powered referral and resource discovery tool",
  icons: {
    icon: "/img/logo.svg",
  },
};

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale: requested } = await params;
  const locale = hasLocale(locales, requested) ? requested : defaultLocale;
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="font-sans">
        <Layout locale={locale}>{children}</Layout>
      </body>
    </html>
  );
}
