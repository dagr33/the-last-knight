import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Last Knight — Hold the Fallen Keep",
  description: "A pixel-art medieval survival game. Fight with sword and shield, survive the waves, and write your legend.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
