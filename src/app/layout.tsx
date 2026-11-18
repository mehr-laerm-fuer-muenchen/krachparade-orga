import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Downloaded at build time and served from our own domain (no request to
// Google from the browser).
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Krachparade Orga",
  description: "Planungs-App der Kern-Orga der Krachparade",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Lets the header and tab bar reach into the safe areas (notch, home bar).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme before React (spec 034).
    <html lang="de" className={`${interTight.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
