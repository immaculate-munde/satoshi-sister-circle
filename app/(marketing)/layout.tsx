/** Welcome / landing: full-bleed marketing surface (responsive). */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh w-full flex-col">{children}</div>;
}
