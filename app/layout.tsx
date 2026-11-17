import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Chama on Lightning",
  description: "Save together. Paid out on time. A rotating savings circle on Bitcoin Lightning.",
  applicationName: "Chama on Lightning",
  appleWebApp: { capable: true, title: "Chama", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0F6B4C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = config();
  const jar = await cookies();
  const cookieLocale = jar.get("locale")?.value;
  const locale: Locale = cookieLocale === "sw" || cookieLocale === "en" ? cookieLocale : process.env.NEXT_PUBLIC_DEFAULT_LOCALE === "sw" ? "sw" : "en";
  const mode = { provider: cfg.mode, simulatedPayments: cfg.allowSimulatedPayments, live: cfg.liveFunds, bitcoinEnabled: cfg.bitcoinEnabled, network: getProvider().network };
  return (
    <html lang={locale} className={`${jakarta.variable} h-full antialiased`}>
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
