import type { Metadata } from "next";
import { Inter, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LOKI — Latent Outcomes & Knowledge Intelligence",
  description: "Enterprise AI platform for multi-agent persona simulation, risk synthesis, and scenario forecasting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} ${ibmPlexMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-base text-ink font-body selection:bg-accent/30 selection:text-white overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
