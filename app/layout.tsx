import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { currentUser } from "@/lib/auth";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Direct Optimize Lead Automation Dashboard",
  description: "Compliant lead generation, outreach, and analytics dashboard."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppShell userRole={user?.role} userName={user?.name || user?.username || undefined}>{children}</AppShell>
      </body>
    </html>
  );
}
