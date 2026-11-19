import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { AppProviders, type Locale } from "@/components/providers";
import { OfflineBanner } from "@/components/ui";
import { ServiceWorker } from "@/components/service-worker";
import { config } from "@/lib/config";
import { getProvider } from "@/lib/payments";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Key-ching: Your chama on Lightning",
  description: "Save together. Paid out on time. A rotating savings circle on Bitcoin Lightning.",
  applicationName: "Key-ching",
  appleWebApp: { capable: true, title: "Key-ching", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#21212E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = config();
  const jar = await cookies();
  const cookieLocale = jar.get("locale")?.value;
  const locale: Locale = cookieLocale === "sw" || cookieLocale === "en" ? cookieLocale : process.env.NEXT_PUBLIC_DEFAULT_LOCALE === "sw" ? "sw" : "en";
  const mode = { provider: cfg.mode, simulatedPayments: cfg.allowSimulatedPayments, network: (await getProvider()).network };
  return (
    <html lang={locale} className={`${jakarta.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        <AppProviders initialLocale={locale} mode={mode}>
          <div className="safe-top flex min-h-dvh w-full flex-col">
            <OfflineBanner />
            {children}
          </div>
          <ServiceWorker />
        </AppProviders>
      </body>
    </html>
  );
}
