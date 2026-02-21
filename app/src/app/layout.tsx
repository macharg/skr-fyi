import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "skr.fyi — Solana Seeker Ecosystem Analytics",
  description:
    "Real-time analytics dashboard for the Solana Seeker ecosystem. Track 200K+ device owners, on-chain activity, holdings, dApp usage, and the SKR economy.",
  openGraph: {
    title: "skr.fyi",
    description: "Solana Seeker Ecosystem Analytics",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Sora:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
