import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/content";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Daniel Ariel — Senior AI Consultant & Senior Frontend Developer";

export const metadata: Metadata = {
  metadataBase: new URL("https://danielariel-seven.vercel.app"),
  title,
  description: site.tagline,
  openGraph: {
    title,
    description: site.tagline,
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title, description: site.tagline },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  jobTitle: "Senior AI Consultant & Senior Frontend Developer",
  email: `mailto:${site.email}`,
  url: "https://danielariel-seven.vercel.app",
  sameAs: [site.linkedin],
  address: { "@type": "PostalAddress", addressLocality: "Berlin", addressCountry: "DE" },
  knowsLanguage: ["en", "he", "de"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-bg font-sans text-ink antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <a
          href="#top"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
