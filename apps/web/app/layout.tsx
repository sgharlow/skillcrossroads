import type { Metadata, Viewport } from "next";
import "./globals.css";

const DESCRIPTION =
  "Crossroads gives your Claude Code skills, agents, and MCP servers an evidence-based quality grade — so you know whether to ship, fix, or rethink before you release.";

export const metadata: Metadata = {
  metadataBase: new URL("https://crossroads.app"),
  title: {
    default: "Crossroads — Know before you ship.",
    template: "%s · Crossroads",
  },
  description: DESCRIPTION,
  applicationName: "Crossroads",
  openGraph: {
    title: "Crossroads — Know before you ship.",
    description: DESCRIPTION,
    url: "https://crossroads.app",
    siteName: "Crossroads",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crossroads — Know before you ship.",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
