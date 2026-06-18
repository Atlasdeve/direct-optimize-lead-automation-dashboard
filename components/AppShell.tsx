"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PublicIcon from "@mui/icons-material/Public";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import EmailIcon from "@mui/icons-material/Email";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ForumIcon from "@mui/icons-material/Forum";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BarChartIcon from "@mui/icons-material/BarChart";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import CampaignIcon from "@mui/icons-material/Campaign";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import AssessmentIcon from "@mui/icons-material/Assessment";
import DownloadIcon from "@mui/icons-material/Download";
import WorkIcon from "@mui/icons-material/Work";
import SettingsIcon from "@mui/icons-material/Settings";
import ShieldIcon from "@mui/icons-material/Shield";
import LogoutIcon from "@mui/icons-material/Logout";
import { clsx } from "clsx";

const nav = [
  { href: "/", label: "Overview", icon: DashboardIcon },
  { href: "/dashboard", label: "Region Leads", icon: PublicIcon },
  { href: "/automation", label: "Automation", icon: PlayCircleIcon },
  { href: "/campaigns", label: "Campaigns", icon: CampaignIcon },
  { href: "/reports", label: "Reports", icon: AssessmentIcon },
  { href: "/pipeline", label: "Pipeline", icon: ViewKanbanIcon },
  { href: "/review", label: "Review Queue", icon: FactCheckIcon },
  { href: "/contact-forms", label: "Contact Forms", icon: ContactPageIcon },
  { href: "/opportunities", label: "Opportunities", icon: WorkIcon },
  { href: "/duplicates", label: "Duplicates", icon: ContentCopyIcon },
  { href: "/export", label: "CSV Export", icon: DownloadIcon },
  { href: "/compose-email", label: "Compose Email", icon: MarkEmailReadIcon },
  { href: "/templates/email", label: "Email Templates", icon: EmailIcon },
  { href: "/templates/whatsapp", label: "WhatsApp Numbers", icon: WhatsAppIcon },
  { href: "/replies", label: "Inbox Replies", icon: ForumIcon },
  { href: "/ai-drafts", label: "AI Drafts", icon: AutoAwesomeIcon },
  { href: "/analytics", label: "Analytics", icon: BarChartIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") {
    return <main className="px-4 py-4 lg:px-8 lg:py-8">{children}</main>;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-72 overflow-y-auto border-r border-line bg-black/28 p-5 backdrop-blur-2xl lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-200 soft-border">
            <ShieldIcon />
          </div>
          <div>
            <div className="text-sm text-slate-400">Direct Optimize</div>
            <div className="font-semibold leading-tight text-white">Lead Automation</div>
          </div>
        </div>
        <nav className="space-y-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition",
                  active ? "bg-sky-400/18 text-white soft-border" : "text-slate-300 hover:bg-white/7 hover:text-white"
                )}
              >
                <Icon fontSize="small" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 rounded-lg bg-emerald-400/10 p-4 text-xs text-emerald-100 soft-border">
          Official APIs only. Rate limits, unsubscribe handling, consent fields, and outreach logs are built in.
        </div>
        <button
          onClick={logout}
          className="mt-4 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-300 transition soft-border hover:bg-white/7 hover:text-white"
        >
          <LogoutIcon fontSize="small" />
          Sign out
        </button>
      </aside>
      <main className="px-4 py-4 lg:ml-72 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
