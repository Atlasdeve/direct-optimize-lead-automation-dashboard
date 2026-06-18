"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LanguageIcon from "@mui/icons-material/Language";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import PlaceIcon from "@mui/icons-material/Place";
import SendIcon from "@mui/icons-material/Send";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import { RegionTabs } from "@/components/RegionTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { getLocalTime, getRegion } from "@/lib/regions";
import { listLeads, listNotifications } from "@/lib/store";
import { whatsappNumberFromPhone } from "@/lib/whatsappIdentification";
import type { AutomationResult, Lead } from "@/lib/types";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type NotificationItem = ReturnType<typeof listNotifications>[number];
type DashboardMode = "overview" | "leads" | "automation";

function metricCards(leads: Lead[]) {
  return [
    { label: "Total leads", value: leads.length },
    { label: "New leads", value: leads.filter((lead) => lead.outreach_status === "New").length },
    { label: "Ready to send", value: leads.filter((lead) => lead.email && lead.outreach_approved && !lead.email_sent && !lead.unsubscribed && !lead.do_not_contact).length },
    { label: "Contacted", value: leads.filter((lead) => lead.email_sent || lead.whatsapp_sent).length },
    { label: "Emails sent", value: leads.filter((lead) => lead.email_sent).length },
    { label: "WhatsApp numbers", value: leads.filter((lead) => lead.phone || lead.whatsapp_available).length },
    { label: "Replies", value: leads.filter((lead) => lead.replied).length },
    { label: "Pending follow-ups", value: leads.filter((lead) => lead.outreach_status === "Follow-up").length }
  ];
}

function buildDashboardCharts(leads: Lead[]) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const dayLeads = leads.filter((lead) => lead.created_at?.slice(0, 10) === key);
    return {
      day: dayNames[date.getDay()],
      leads: dayLeads.length,
      emails: dayLeads.filter((lead) => lead.email).length,
      replies: dayLeads.filter((lead) => lead.replied).length
    };
  });

  const regions = ["Canada", "USA", "UK", "UAE", "Qatar"].map((region) => {
    const regionLeads = leads.filter((lead) => lead.region === region);
    return {
      region,
      leads: regionLeads.length,
      contacted: regionLeads.filter((lead) => lead.email_sent || lead.outreach_status === "Contacted").length,
      replies: regionLeads.filter((lead) => lead.replied).length,
      forms: regionLeads.filter((lead) => (lead.contact_forms?.length ?? 0) > 0).length
    };
  });

  const funnel = [
    { name: "Leads", value: leads.length, color: "#38bdf8" },
    { name: "Contact found", value: leads.filter((lead) => lead.email || lead.phone || (lead.contact_forms?.length ?? 0) > 0).length, color: "#818cf8" },
    { name: "Reviewed", value: leads.filter((lead) => lead.outreach_approved || lead.do_not_contact || lead.unsubscribed).length, color: "#34d399" },
    { name: "Contacted", value: leads.filter((lead) => lead.email_sent || lead.outreach_status === "Contacted").length, color: "#fbbf24" },
    { name: "Replied", value: leads.filter((lead) => lead.replied).length, color: "#a3e635" },
    { name: "Meeting booked", value: leads.filter((lead) => lead.outreach_status === "Meeting Booked").length, color: "#fb7185" }
  ];

  return { daily, regions, funnel };
}

function ChannelIconLink({
  href,
  label,
  children,
  disabled = false
}: {
  href?: string | null;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (!href || disabled) {
    return (
      <span
        aria-label={label}
        title={label}
        className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-slate-600 soft-border"
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="grid h-8 w-8 place-items-center rounded-lg bg-white/8 text-slate-200 transition soft-border hover:bg-sky-400/18 hover:text-sky-100"
    >
      {children}
    </a>
  );
}

export function Dashboard({ mode = "overview" }: { mode?: DashboardMode }) {
  const [selectedRegion, setSelectedRegion] = useState("Canada");
  const [leads, setLeads] = useState(() => listLeads(selectedRegion));
  const [allLeads, setAllLeads] = useState(() => listLeads());
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => listNotifications());
  const [running, setRunning] = useState(false);
  const [discoveringEmails, setDiscoveringEmails] = useState(false);
  const [enrichingLeads, setEnrichingLeads] = useState(false);
  const [result, setResult] = useState<AutomationResult | null>(null);
  const [sendApprovedResult, setSendApprovedResult] = useState<null | {
    attempted: number;
    sent: number;
    skipped: number;
    failed: number;
    remaining: number;
    liveSendingEnabled: boolean;
    logs: string[];
  }>(null);
  const [sendingApproved, setSendingApproved] = useState(false);
  const [emailDiscoveryResult, setEmailDiscoveryResult] = useState<null | {
    scanned: number;
    updated: number;
    found: number;
    formsFound?: number;
    failed: number;
  }>(null);
  const [enrichmentResult, setEnrichmentResult] = useState<null | {
    scanned: number;
    updated: number;
    emailAdded: number;
    websiteAdded: number;
    phoneAdded: number;
    failed: number;
    providers: { googlePlaces: boolean; hunter: boolean; builtWith: boolean };
    logs: string[];
  }>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const region = getRegion(selectedRegion);

  const pageLeads = leads;
  const metrics = useMemo(() => metricCards(pageLeads), [pageLeads]);
  const chart = useMemo(() => buildDashboardCharts(pageLeads), [pageLeads]);
  const regionPerformanceChart = useMemo(() => buildDashboardCharts(allLeads), [allLeads]);
  const maxFunnelValue = Math.max(...chart.funnel.map((item) => item.value), 1);
  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const haystack = [
        lead.company_name,
        lead.city,
        lead.country,
        lead.category,
        lead.business_type,
        lead.email,
        lead.phone,
        lead.website
      ].filter(Boolean).join(" ").toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (statusFilter !== "all" && lead.outreach_status !== statusFilter) return false;
      if (contactFilter === "email" && !lead.email) return false;
      if (contactFilter === "phone" && !lead.phone) return false;
      if (contactFilter === "form" && (lead.contact_forms?.length ?? 0) === 0) return false;
      if (contactFilter === "whatsapp" && !whatsappNumberFromPhone(lead.phone)) return false;
      if (contactFilter === "missing_email" && lead.email) return false;
      if (scoreFilter === "high" && lead.lead_score < 70) return false;
      if (scoreFilter === "medium" && (lead.lead_score < 40 || lead.lead_score >= 70)) return false;
      if (scoreFilter === "low" && lead.lead_score >= 40) return false;
      return true;
    });
  }, [leads, search, statusFilter, contactFilter, scoreFilter]);

  useEffect(() => {
    let active = true;
    async function loadRegionData() {
      const [leadData, allLeadData, notificationData] = await Promise.all([
        fetch(`/api/leads?region=${encodeURIComponent(selectedRegion)}`).then((res) => res.json()),
        fetch("/api/leads").then((res) => res.json()),
        fetch("/api/notifications").then((res) => res.json())
      ]);
      if (!active) return;
      setLeads(leadData.leads ?? []);
      setAllLeads(allLeadData.leads ?? []);
      setNotifications(notificationData.notifications ?? []);
    }
    void loadRegionData();
    return () => {
      active = false;
    };
  }, [selectedRegion]);

  async function startAutomation() {
    setRunning(true);
    const response = await fetch("/api/automation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: selectedRegion })
    });
    const data = (await response.json()) as AutomationResult;
    setResult(data);
    if (data.status === "queued") {
      await new Promise((resolve) => setTimeout(resolve, 1600));
    }
    const [refreshed, allLeadData, notificationData] = await Promise.all([
      fetch(`/api/leads?region=${encodeURIComponent(selectedRegion)}`).then((res) => res.json()),
      fetch("/api/leads").then((res) => res.json()),
      fetch("/api/notifications").then((res) => res.json())
    ]);
    setLeads(refreshed.leads ?? []);
    setAllLeads(allLeadData.leads ?? []);
    setNotifications(notificationData.notifications);
    setRunning(false);
  }

  async function discoverEmails() {
    setDiscoveringEmails(true);
    const response = await fetch("/api/leads/discover-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: selectedRegion, limit: 10 })
    });
    const data = await response.json();
    setEmailDiscoveryResult(data);
    const [refreshed, allLeadData, notificationData] = await Promise.all([
      fetch(`/api/leads?region=${encodeURIComponent(selectedRegion)}`).then((res) => res.json()),
      fetch("/api/leads").then((res) => res.json()),
      fetch("/api/notifications").then((res) => res.json())
    ]);
    setLeads(refreshed.leads ?? []);
    setAllLeads(allLeadData.leads ?? []);
    setNotifications(notificationData.notifications);
    setDiscoveringEmails(false);
  }

  async function enrichLeads() {
    setEnrichingLeads(true);
    const response = await fetch("/api/leads/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: selectedRegion, limit: 10 })
    });
    const data = await response.json();
    setEnrichmentResult(data);
    const [refreshed, allLeadData, notificationData] = await Promise.all([
      fetch(`/api/leads?region=${encodeURIComponent(selectedRegion)}`).then((res) => res.json()),
      fetch("/api/leads").then((res) => res.json()),
      fetch("/api/notifications").then((res) => res.json())
    ]);
    setLeads(refreshed.leads ?? []);
    setAllLeads(allLeadData.leads ?? []);
    setNotifications(notificationData.notifications);
    setEnrichingLeads(false);
  }

  async function sendApprovedEmails() {
    setSendingApproved(true);
    const response = await fetch("/api/outreach/send-approved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: selectedRegion, limit: 25 })
    });
    const data = await response.json();
    setSendApprovedResult(data);
    const [refreshed, allLeadData] = await Promise.all([
      fetch(`/api/leads?region=${encodeURIComponent(selectedRegion)}`).then((res) => res.json()),
      fetch("/api/leads").then((res) => res.json())
    ]);
    setLeads(refreshed.leads ?? []);
    setAllLeads(allLeadData.leads ?? []);
    setSendingApproved(false);
  }

  function selectRegion(nextRegion: string) {
    setSelectedRegion(nextRegion);
    setResult(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-medium text-sky-200">
            {mode === "overview" ? "Executive overview" : mode === "automation" ? "Automation command center" : "Lead operations"}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white md:text-5xl">
            {mode === "overview" && "Direct Optimize Lead Automation Dashboard"}
            {mode === "automation" && "Run discovery, enrichment, and approved outreach"}
            {mode === "leads" && "Search, filter, and inspect regional leads"}
          </h1>
        </div>
        {mode !== "overview" && <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={sendApprovedEmails}
            disabled={sendingApproved}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-400/14 px-5 font-semibold text-emerald-100 transition soft-border hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <SendIcon />
            {sendingApproved ? "Sending..." : "Send Approved"}
          </button>
          <button
            onClick={enrichLeads}
            disabled={enrichingLeads}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white/8 px-5 font-semibold text-white transition soft-border hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <ManageSearchIcon />
            {enrichingLeads ? "Enriching..." : "Enrich Details"}
          </button>
          <button
            onClick={discoverEmails}
            disabled={discoveringEmails}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white/8 px-5 font-semibold text-white transition soft-border hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <AlternateEmailIcon />
            {discoveringEmails ? "Discovering..." : "Discover Emails"}
          </button>
          <button
            onClick={startAutomation}
            disabled={running}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-sky-400 px-6 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <PlayArrowIcon />
            {running ? "Running..." : "Start Automation"}
          </button>
        </div>}
      </header>

      <RegionTabs selected={selectedRegion} onSelect={selectRegion} />

      {mode !== "automation" && <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="glass rounded-xl p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{mode === "overview" ? `${selectedRegion} overview` : `${selectedRegion} leads`}</h2>
              <p className="text-sm text-slate-400">{mode === "overview" ? `Filtered performance for ${selectedRegion}` : `${region.country} local time: ${getLocalTime(region.timezone)}`}</p>
            </div>
            <div className="rounded-lg bg-white/7 px-3 py-2 text-sm text-slate-200 soft-border">{region.timezone}</div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg bg-white/6 p-3 soft-border">
                <div className="text-xs text-slate-400">{metric.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="mb-4 flex items-center gap-2 text-white">
            <NotificationsIcon fontSize="small" />
            <h2 className="font-semibold">Notifications</h2>
          </div>
          <div className="space-y-3">
            {notifications.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg bg-white/6 p-3 soft-border">
                <div className="text-sm font-medium text-white">{item.title}</div>
                <div className="mt-1 text-xs text-slate-400">{item.message}</div>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {mode === "automation" && (
        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="glass rounded-xl p-5">
            <h2 className="font-semibold text-white">Automation workflow</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-lg bg-white/6 p-4 soft-border">
                <div className="text-sm font-medium text-white">1. Find Leads</div>
                <p className="mt-1 text-sm text-slate-400">Pulls businesses from Google Places for the selected region.</p>
              </div>
              <div className="rounded-lg bg-white/6 p-4 soft-border">
                <div className="text-sm font-medium text-white">2. Enrich Details</div>
                <p className="mt-1 text-sm text-slate-400">Adds Google Place details, Hunter email/domain data, and BuiltWith technology signals when API keys are configured.</p>
              </div>
              <div className="rounded-lg bg-white/6 p-4 soft-border">
                <div className="text-sm font-medium text-white">3. Discover Emails</div>
                <p className="mt-1 text-sm text-slate-400">Scans public websites for emails, contact forms, and contact pages.</p>
              </div>
              <div className="rounded-lg bg-white/6 p-4 soft-border">
                <div className="text-sm font-medium text-white">4. Send Approved</div>
                <p className="mt-1 text-sm text-slate-400">Processes only reviewed and approved email leads; live sending remains controlled by env safety flags.</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <h2 className="mb-4 font-semibold text-white">Region readiness</h2>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg bg-white/6 p-3 soft-border">
                  <div className="text-xs text-slate-400">{metric.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {result && (
        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={result.status === "completed" ? "Closed" : result.status === "queued" ? "Follow-up" : "Failed"} />
            <span className="text-sm text-slate-300">
              {result.region}: {result.leadsFetched} leads, {result.emailsSent} emails, {result.failedCount} failures.
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {result.logs.map((log) => (
              <div key={log} className="rounded-md bg-black/20 px-3 py-2 text-xs text-slate-300 soft-border">{log}</div>
            ))}
          </div>
        </section>
      )}

      {emailDiscoveryResult && (
        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={emailDiscoveryResult.updated > 0 ? "Replied" : "Follow-up"} />
            <span className="text-sm text-slate-300">
              Email discovery scanned {emailDiscoveryResult.scanned} leads, found {emailDiscoveryResult.found} email(s), updated {emailDiscoveryResult.updated} lead(s), failed {emailDiscoveryResult.failed}.
              {typeof emailDiscoveryResult.formsFound === "number" ? ` Contact forms found: ${emailDiscoveryResult.formsFound}.` : ""}
            </span>
          </div>
        </section>
      )}

      {sendApprovedResult && (
        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={sendApprovedResult.sent > 0 ? "Contacted" : "Follow-up"} />
            <span className="text-sm text-slate-300">
              Send approved: attempted {sendApprovedResult.attempted}, sent {sendApprovedResult.sent}, skipped {sendApprovedResult.skipped}, failed {sendApprovedResult.failed}. Daily remaining: {sendApprovedResult.remaining}.
              {!sendApprovedResult.liveSendingEnabled ? " Live sending is disabled." : ""}
            </span>
          </div>
          {sendApprovedResult.logs.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {sendApprovedResult.logs.slice(0, 6).map((log) => (
                <div key={log} className="rounded-md bg-black/20 px-3 py-2 text-xs text-slate-300 soft-border">{log}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {enrichmentResult && (
        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={enrichmentResult.updated > 0 ? "Replied" : "Follow-up"} />
            <span className="text-sm text-slate-300">
              Enriched {enrichmentResult.updated} lead(s). Emails added {enrichmentResult.emailAdded}, websites added {enrichmentResult.websiteAdded}, phones added {enrichmentResult.phoneAdded}. Providers: Google Places {enrichmentResult.providers.googlePlaces ? "on" : "off"}, Hunter {enrichmentResult.providers.hunter ? "on" : "off"}, BuiltWith {enrichmentResult.providers.builtWith ? "on" : "off"}.
            </span>
          </div>
          {enrichmentResult.logs.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {enrichmentResult.logs.slice(0, 6).map((log) => (
                <div key={log} className="rounded-md bg-black/20 px-3 py-2 text-xs text-slate-300 soft-border">{log}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {mode === "leads" && <section className="grid gap-4">
        <div className="glass rounded-xl">
          <div className="flex flex-col gap-4 border-b border-line p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Region leads</h2>
              <div className="text-sm text-slate-400">{filteredLeads.length} of {leads.length}</div>
            </div>
            {mode === "leads" && (
              <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,0.7fr)]">
                <label className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fontSize="small" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search company, city, category, email, phone..."
                    className="h-11 w-full rounded-lg border border-line bg-black/20 pl-10 pr-3 text-sm text-white outline-none focus:border-sky-300"
                  />
                </label>
                <label className="relative">
                  <FilterAltIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fontSize="small" />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-black/20 pl-10 pr-3 text-sm text-white outline-none focus:border-sky-300">
                    <option value="all">All statuses</option>
                    <option value="New">New</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Replied">Replied</option>
                    <option value="Meeting Booked">Meeting Booked</option>
                    <option value="Closed">Closed</option>
                    <option value="Failed">Failed</option>
                  </select>
                </label>
                <select value={contactFilter} onChange={(event) => setContactFilter(event.target.value)} className="h-11 rounded-lg border border-line bg-black/20 px-3 text-sm text-white outline-none focus:border-sky-300">
                  <option value="all">All contacts</option>
                  <option value="email">Has email</option>
                  <option value="missing_email">Missing email</option>
                  <option value="phone">Has phone</option>
                  <option value="form">Has form</option>
                  <option value="whatsapp">WhatsApp shortcut</option>
                </select>
                <select value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value)} className="h-11 rounded-lg border border-line bg-black/20 px-3 text-sm text-white outline-none focus:border-sky-300">
                  <option value="all">All scores</option>
                  <option value="high">High 70+</option>
                  <option value="medium">Medium 40-69</option>
                  <option value="low">Low under 40</option>
                </select>
              </div>
            )}
          </div>
          <div className="divide-y divide-line">
            <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)_90px_104px_minmax(0,1fr)] gap-3 bg-white/5 px-5 py-3 text-xs uppercase text-slate-400 lg:grid">
              <div>Company</div>
              <div>Contact</div>
              <div>Score</div>
              <div>Status</div>
              <div>Channels</div>
            </div>
            {filteredLeads.map((lead) => {
              const contactForm = lead.contact_forms?.[0] ?? null;
              const whatsappNumber = whatsappNumberFromPhone(lead.phone);
              const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null;
              return (
                <div
                  key={lead.id}
                  className="grid gap-4 px-5 py-4 text-sm lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)_90px_104px_minmax(0,1fr)] lg:items-center lg:gap-3"
                >
                  <div className="min-w-0">
                    <Link href={`/leads/${lead.id}`} className="block truncate font-medium text-white hover:text-sky-200">
                      {lead.company_name}
                    </Link>
                    <div className="mt-1 truncate text-xs text-slate-400">{lead.city} · {lead.category}</div>
                  </div>

                  <div className="min-w-0 space-y-1 text-slate-300">
                    <a
                      href={lead.email ? `mailto:${lead.email}` : undefined}
                      className={lead.email ? "flex min-w-0 items-center gap-2 hover:text-sky-200" : "flex min-w-0 items-center gap-2 text-slate-500"}
                    >
                      <EmailIcon fontSize="inherit" />
                      <span className="truncate">{lead.email ?? "Email pending"}</span>
                    </a>
                    <a
                      href={lead.phone ? `tel:${lead.phone}` : undefined}
                      className={lead.phone ? "flex min-w-0 items-center gap-2 hover:text-sky-200" : "flex min-w-0 items-center gap-2 text-slate-500"}
                    >
                      <PhoneIcon fontSize="inherit" />
                      <span className="truncate">{lead.phone ?? "Phone pending"}</span>
                    </a>
                  </div>

                  <div>
                    <div className="h-2 w-full max-w-28 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-sky-300" style={{ width: `${lead.lead_score}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{lead.lead_score}/100</div>
                  </div>

                  <div>
                    <StatusBadge status={lead.outreach_status} />
                  </div>

                  <div className="flex flex-wrap gap-2 text-slate-300">
                    <ChannelIconLink href={lead.website} label={lead.website ? "Open website" : "Website unavailable"}>
                      <LanguageIcon fontSize="small" />
                    </ChannelIconLink>
                    <ChannelIconLink href={lead.google_maps_url} label={lead.google_maps_url ? "Open Google Maps" : "Google Maps unavailable"}>
                      <PlaceIcon fontSize="small" />
                    </ChannelIconLink>
                    <ChannelIconLink href={lead.email ? `mailto:${lead.email}` : null} label={lead.email ? "Email lead" : "Email unavailable"}>
                      <EmailIcon fontSize="small" />
                    </ChannelIconLink>
                    <ChannelIconLink href={lead.phone ? `tel:${lead.phone}` : null} label={lead.phone ? "Call lead" : "Phone unavailable"}>
                      <PhoneIcon fontSize="small" />
                    </ChannelIconLink>
                    <ChannelIconLink href={contactForm} label={contactForm ? "Open contact form" : "Contact form unavailable"}>
                      <ContactPageIcon fontSize="small" />
                    </ChannelIconLink>
                    <ChannelIconLink href={whatsappHref} label={whatsappHref ? "Open WhatsApp chat" : "WhatsApp unavailable"}>
                      <WhatsAppIcon fontSize="small" />
                    </ChannelIconLink>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </section>}

      {mode === "overview" && (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
          <div className="glass rounded-xl p-5">
            <h2 className="mb-4 font-semibold text-white">Leads fetched per day</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart.daily}>
                  <defs>
                    <linearGradient id="leads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,.16)" vertical={false} />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#06111f", border: "1px solid rgba(148,163,184,.25)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="leads" stroke="#38bdf8" fill="url(#leads)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <h2 className="mb-4 font-semibold text-white">Conversion funnel</h2>
            <div className="space-y-3">
              {chart.funnel.map((item) => (
                <div key={item.name} className="rounded-lg bg-white/6 p-3 soft-border">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300">{item.name}</span>
                    <span className="font-semibold text-white">{item.value}</span>
                  </div>
                  <div className="h-3 rounded-full bg-black/25">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        width: `${Math.max(3, (item.value / maxFunnelValue) * 100)}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {mode === "overview" && <section className="glass rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="font-semibold text-white">Region-wise performance</h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" />Leads</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-400" />Contacted</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />Replies</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-300" />Forms</span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionPerformanceChart.regions} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,.16)" vertical={false} />
              <XAxis dataKey="region" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#06111f", border: "1px solid rgba(148,163,184,.25)", borderRadius: 8 }} />
              <Bar dataKey="leads" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="contacted" fill="#818cf8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="replies" fill="#34d399" radius={[6, 6, 0, 0]} />
              <Bar dataKey="forms" fill="#fbbf24" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>}
    </div>
  );
}
