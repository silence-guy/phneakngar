import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Khmer } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ToasterProvider } from "@/components/toaster-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MockNetworkBanner } from "@/components/mock-network-banner";
import { TauriThemeSync } from "@/components/tauri-theme-sync";
import { DEFAULT_WEB_LOCALE } from "@/lib/locale";
import { resolveMetadataBase } from "@/lib/public-site-url";
import { getPublicMetaLabels } from "@/app/public-meta-labels";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansKhmer = Noto_Sans_Khmer({
  variable: "--font-noto-sans-khmer",
  subsets: ["khmer"],
  weight: ["400", "500", "600"],
});

const METADATA_BASE = resolveMetadataBase();
const SITE_URL = METADATA_BASE.origin;
const EN_META = getPublicMetaLabels("en");
const SITE_TITLE = EN_META.siteTitle;
const ENABLE_GTM = process.env.NODE_ENV === "production";
const SITE_DESCRIPTION = EN_META.siteDescription;
const OG_IMAGE_URL = "/og?title=Your+Agent.+Always+Working";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
};

export const metadata: Metadata = {
  metadataBase: METADATA_BASE,
  title: {
    default: SITE_TITLE,
    template: "%s | Phneakngar",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    languages: {
      en: "/",
      km: "/km",
    },
  },
  icons: {
    icon: [
      {
        url: "/logo-mark.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo-mark-dark.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Phneakngar",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    alternateLocale: ["km_KH"],
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: EN_META.ogImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@phneakngar_ai",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Phneakngar",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "All",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Phneakngar",
  url: SITE_URL,
  logo: `${SITE_URL}/logo-mark.svg`,
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@phneakngar.ai",
    contactType: "customer support",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={DEFAULT_WEB_LOCALE}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansKhmer.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <template dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
        `}} />
      </head>
        {ENABLE_GTM && <GoogleTagManager gtmId="GTM-56VHCCQZ" />}
      <body
        className="min-h-full flex flex-col"
      >
        <MockNetworkBanner />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([webApplicationJsonLd, organizationJsonLd]),
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TauriThemeSync />
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
