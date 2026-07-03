import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { currentUser } from "@/lib/auth";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Direct Optimize Lead Automation Dashboard",
  description: "Compliant lead generation, outreach, and analytics dashboard.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Direct Optimize"
  },
  icons: { icon: "/app-icon-192.png", apple: "/app-icon-192.png" }
};

export const viewport: Viewport = {
  themeColor: "#071426",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegistration />
        <AppShell userRole={user?.role} userName={user?.name || user?.username || undefined}>{children}</AppShell>
      </body>
    </html>
  );
}
