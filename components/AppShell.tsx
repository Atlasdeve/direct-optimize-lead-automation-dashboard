"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import GroupsIcon from "@mui/icons-material/Groups";
import BadgeIcon from "@mui/icons-material/Badge";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import DialpadIcon from "@mui/icons-material/Dialpad";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { clsx } from "clsx";
import { AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { PushNotificationControl } from "@/components/PushNotificationControl";

const nav = [
  { href: "/", label: "Overview", icon: DashboardIcon },
  { href: "/dashboard", label: "Region Leads", icon: PublicIcon },
  { href: "/automation", label: "Automation", icon: PlayCircleIcon },
  { href: "/campaigns", label: "Campaigns", icon: CampaignIcon },
  { href: "/calls", label: "Calls", icon: PhoneInTalkIcon },
  { href: "/compose-call", label: "Compose Call", icon: DialpadIcon },
  { href: "/reports", label: "Reports", icon: AssessmentIcon },
  { href: "/pipeline", label: "Pipeline", icon: ViewKanbanIcon },
  { href: "/review", label: "Review Queue", icon: FactCheckIcon },
  { href: "/contact-forms", label: "Contact Forms", icon: ContactPageIcon },
  { href: "/opportunities", label: "Opportunities", icon: WorkIcon },
  { href: "/projects", label: "Client Projects", icon: GroupsIcon },
  { href: "/portal-users", label: "Portal Users", icon: AccountCircleIcon },
  { href: "/employee-portal", label: "Employee Portal", icon: BadgeIcon },
  { href: "/client-portal", label: "Client Portal", icon: AccountCircleIcon },
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

const clientNav = [
  { href: "/client-portal", label: "Progress Portal", icon: AccountCircleIcon },
  { href: "/client-profile", label: "Client Profile", icon: ManageAccountsIcon }
];

const employeeNav = [
  { href: "/employee-portal", label: "Employee Portal", icon: BadgeIcon }
];

export function AppShell({ children, userRole, userName }: { children: React.ReactNode; userRole?: string; userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isClient = userRole === "client";
  const isEmployee = userRole === "employee";
  const navigation = isClient ? clientNav : isEmployee ? employeeNav : nav;

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  function isActiveRoute(href: string) {
    if (href === "/") return pathname === "/";
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
    if (!isClient && !isEmployee && href === "/dashboard") return pathname.startsWith("/leads/");
    if (isClient && href === "/client-portal") return pathname.startsWith("/projects/");
    if (isEmployee && href === "/employee-portal") return pathname.startsWith("/projects/");
    return false;
  }

  if (pathname === "/client-register") {
    return <>{children}</>;
  }

  if (pathname === "/login") {
    return <main className="px-4 py-4 lg:px-8 lg:py-8">{children}</main>;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
    return navigation.map((item) => {
      const Icon = item.icon;
      const active = isActiveRoute(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={clsx(
            "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
            active
              ? "bg-sky-400 text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.18)]"
              : "text-slate-300 hover:bg-white/7 hover:text-white"
          )}
        >
          <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-md", active ? "bg-slate-950/12" : "bg-white/5")}>
            <Icon fontSize="small" />
          </span>
          {item.label}
        </Link>
      );
    });
  }

  return (
    <div className="min-h-screen">
      {userRole && <AdminNotificationCenter userRole={userRole} />}
      <aside className="fixed inset-y-0 left-0 hidden w-72 overflow-y-auto border-r border-line bg-black/28 p-5 backdrop-blur-2xl lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-200 soft-border">
            <ShieldIcon />
          </div>
          <div>
            <div className="text-sm text-slate-400">Direct Optimize</div>
            <div className="font-semibold leading-tight text-white">{isClient ? "Client Progress" : isEmployee ? "Employee Workspace" : "Lead Automation"}</div>
          </div>
        </div>
        <nav className="space-y-2">
          <NavigationLinks />
        </nav>
        <div className="mt-6 rounded-lg bg-emerald-400/10 p-4 text-xs text-emerald-100 soft-border">
          {isClient ? `${userName || "Client"}, your approved work updates and progress appear here.` : isEmployee ? `${userName || "Employee"}, only assigned projects are available here.` : "Official APIs only. Rate limits, unsubscribe handling, consent fields, and outreach logs are built in."}
        </div>
        <div className="mt-4">
          <PushNotificationControl />
        </div>
        <button
          onClick={logout}
          className="mt-4 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-300 transition soft-border hover:bg-white/7 hover:text-white"
        >
          <LogoutIcon fontSize="small" />
          Sign out
        </button>
      </aside>
      {userRole && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-lg border border-line bg-[#091629]/95 text-slate-100 shadow-xl backdrop-blur-xl hover:bg-[#10213a] lg:hidden"
        >
          <MenuIcon />
        </button>
      )}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="h-full w-[min(20rem,88vw)] overflow-y-auto border-r border-line bg-[#071426] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-400/15 text-sky-200 soft-border"><ShieldIcon /></div>
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-400">Direct Optimize</div>
                  <div className="truncate font-semibold text-white">{isClient ? "Client Progress" : isEmployee ? "Employee Workspace" : "Lead Automation"}</div>
                </div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/7 hover:text-white">
                <CloseIcon />
              </button>
            </div>
            <nav className="space-y-2"><NavigationLinks onNavigate={() => setMobileOpen(false)} /></nav>
            <div className="mt-6 rounded-lg bg-emerald-400/10 p-4 text-xs text-emerald-100 soft-border">
              {isClient ? `${userName || "Client"}, your approved work updates and progress appear here.` : isEmployee ? `${userName || "Employee"}, only assigned projects are available here.` : "Manage leads, outreach, projects, and delivery from your mobile device."}
            </div>
            <div className="mt-4"><PushNotificationControl /></div>
            <button onClick={logout} className="mt-4 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-300 transition soft-border hover:bg-white/7 hover:text-white">
              <LogoutIcon fontSize="small" />
              Sign out
            </button>
          </aside>
        </div>
      )}
      <main className="px-4 pb-4 pt-20 lg:ml-72 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
