import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

/*
 * No `next/font/google`: loading fonts from Google's CDN means every student's browser
 * makes a request to a third party before the page paints. A system font stack is
 * faster, has no layout shift, and is one fewer thing to put in a privacy notice.
 */

export const metadata: Metadata = {
  title: {
    default: "ReviseIQ — GCSE revision that knows what you need today",
    template: "%s · ReviseIQ",
  },
  description:
    "Learn, revise and test yourself on AQA GCSE Biology, Chemistry and Physics. ReviseIQ turns what you know — and what you don't — into a revision plan for today.",
  applicationName: "ReviseIQ",
  authors: [{ name: "ReviseIQ" }],
  formatDetection: { telephone: false, address: false, email: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1c22" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets class/style on <html> before React hydrates.
    <html lang="en-GB" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
