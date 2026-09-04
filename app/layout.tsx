import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { currentSession, currentUser } from "@/lib/auth";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const user = await currentUser().catch(() => null);
  const workspaceName = user?.organization?.companyName || "Direct Optimize";
  return {
    title: `${workspaceName} Lead Automation Dashboard`,
    description: "Compliant lead generation, outreach, and analytics dashboard.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: workspaceName
    },
    icons: { icon: "/app-icon-192.png", apple: "/app-icon-192.png" }
  };
}

export const viewport: Viewport = {
  themeColor: "#071426",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, user] = await Promise.all([
    currentSession().catch(() => null),
    currentUser().catch(() => null)
  ]);
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegistration />
        <AppShell
          userRole={user?.role}
          userName={user?.name || user?.username || undefined}
          workspaceName={user?.organization?.companyName || "Direct Optimize"}
          workspaceSlug={user?.organization?.slug}
          organizationPlan={session ? session.plan : user?.organization?.plan}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
