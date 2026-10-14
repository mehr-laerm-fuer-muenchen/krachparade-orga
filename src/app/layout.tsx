import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
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
    <html lang="de" className={`${interTight.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
