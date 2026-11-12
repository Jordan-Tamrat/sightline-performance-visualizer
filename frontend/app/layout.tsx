import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PageWrapper from "@/components/PageWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sightline.page";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Free Website Performance Checker with Lighthouse & AI | Sightline",
  description:
    "Run a free website performance checker powered by Lighthouse v12 & Gemini AI. Get scores, Web Vitals, and actionable insights in seconds.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Free Website Performance Checker with Lighthouse & AI | Sightline",
    description:
      "Run a free website performance checker powered by Lighthouse v12 & Gemini AI. Get scores, Web Vitals, and actionable insights in seconds.",
    url: siteUrl,
    siteName: "Sightline",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sightline – Free Website Performance Checker",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Website Performance Checker with Lighthouse & AI | Sightline",
    description:
      "Run a free website performance checker powered by Lighthouse v12 & Gemini AI. Get scores, Web Vitals, and actionable insights in seconds.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/favicon_io/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "manifest", url: "/favicon_io/site.webmanifest" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300`}
      >
        <PageWrapper>
          {children}
        </PageWrapper>
      </body>
    </html>
  );
}
