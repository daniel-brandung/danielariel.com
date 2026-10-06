import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

// The arcade keeps the site's original dark palette and Geist fonts
// (see `.arcade` in globals.css), so the games look the way they were built.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`arcade min-h-svh ${geistSans.variable} ${geistMono.variable}`}>
      {children}
    </div>
  );
}
