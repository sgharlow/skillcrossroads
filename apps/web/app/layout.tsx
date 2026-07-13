import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const DESCRIPTION =
  "Skill Crossroads gives your Claude Code skills, agents, slash commands, MCP configs, and plugins an evidence-based quality grade — so you know whether to ship, fix, or rethink before you release.";

export const metadata: Metadata = {
  metadataBase: new URL("https://skillcrossroads.com"),
  title: {
    default: "Skill Crossroads — Know before you ship.",
    template: "%s · Skill Crossroads",
  },
  description: DESCRIPTION,
  applicationName: "Skill Crossroads",
  openGraph: {
    title: "Skill Crossroads — Know before you ship.",
    description: DESCRIPTION,
    url: "https://skillcrossroads.com",
    siteName: "Skill Crossroads",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skill Crossroads — Know before you ship.",
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
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
