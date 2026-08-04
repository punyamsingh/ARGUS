import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { InteractiveBackground } from "@/components/interactive-background";
import { ClaimLocalBriefs } from "@/components/claim-local-briefs";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { THEME_BOOTSTRAP } from "@/lib/theme-bootstrap";

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
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/* Resolves the stored/system theme before first paint — without this
            a light-mode visitor gets a frame of the dark palette. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-full flex flex-col">
        <InteractiveBackground />
        {/* The chrome lives here, not in the pages. A page that renders its own
            is a page that can drift from the rest of the site — which is exactly
            how the brief route ended up with a different wordmark and no nav. */}
        <SiteHeader />
        {children}
        <SiteFooter />
        {/* Renders nothing — moves this browser's briefs into the account on
            first sign-in, wherever that sign-in happened. */}
        <ClaimLocalBriefs />
      </body>
    </html>
  );
}
