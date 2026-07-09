import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beacon — Lighthouse for Claude Code artifacts",
  description:
    "Beacon audits a Claude Code skill and returns an evidence-cited quality scorecard with a letter grade, plus an embeddable badge.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1220",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
