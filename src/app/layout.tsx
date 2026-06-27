import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://argus.local"),
  title: {
    default: "ARGUS — pre-meeting intelligence, in five minutes",
    template: "%s · ARGUS",
  },
  description:
    "Argus turns 45 minutes of scattered pre-meeting research into a single, cited, conversation-ready brief — synthesised from real-time signals the moment you need it.",
  applicationName: "ARGUS",
  keywords: [
    "sales intelligence",
    "pre-meeting brief",
    "B2B sales",
    "account research",
    "AI agent",
  ],
  authors: [{ name: "Team Argus" }],
  openGraph: {
    title: "ARGUS — pre-meeting intelligence, in five minutes",
    description:
      "One screen. Every signal. Walk into every meeting already briefed.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
