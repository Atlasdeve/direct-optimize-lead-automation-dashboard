"use client";

import { useState } from "react";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import SendIcon from "@mui/icons-material/Send";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import { RegionTabs } from "@/components/RegionTabs";
import type { AutomationResult } from "@/lib/types";

export function CampaignBuilder() {
  const [region, setRegion] = useState("Canada");
  const [city, setCity] = useState("Toronto");
  const [categories, setCategories] = useState("dentists, restaurants");
  const [dailyLimit, setDailyLimit] = useState(25);
  const [followUpDelay, setFollowUpDelay] = useState(3);
  const [finalDelay, setFinalDelay] = useState(7);
  const [running, setRunning] = useState<"discover" | "enrich" | "emails" | "send" | null>(null);
  const [result, setResult] = useState<string[]>([]);

  async function runDiscovery() {
    setRunning("discover");
    try {
      const response = await fetch("/api/automation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          city,
          maxResults: dailyLimit,
          categories: categories.split(",").map((item) => item.trim()).filter(Boolean)
        })
      });
      const data = (await response.json()) as AutomationResult & { error?: string };
      if (!response.ok) throw new Error(data.error || `Discovery failed with HTTP ${response.status}`);
      setResult(data.logs);
    } catch (error) {
      setResult([error instanceof Error ? error.message : "Lead discovery failed. Please try again."]);
    } finally {
      setRunning(null);
    }
  }

  async function discoverEmails() {
    setRunning("emails");
    const response = await fetch("/api/leads/discover-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, limit: dailyLimit })
    });
    const data = await response.json();
    setResult([`Scanned ${data.scanned}, found ${data.found} emails, found ${data.formsFound ?? 0} contact forms.`]);
    setRunning(null);
  }

  async function enrichLeads() {
    setRunning("enrich");
    const response = await fetch("/api/leads/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, limit: dailyLimit })
    });
    const data = await response.json();
    setResult([
      `Enriched ${data.updated} leads. Emails added: ${data.emailAdded}, websites added: ${data.websiteAdded}, phones added: ${data.phoneAdded}.`,
      `Providers active: Google Places ${data.providers?.googlePlaces ? "yes" : "no"}, Hunter ${data.providers?.hunter ? "yes" : "no"}, BuiltWith ${data.providers?.builtWith ? "yes" : "no"}.`,
      ...(data.logs ?? [])
    ]);
    setRunning(null);
  }

  async function sendApproved() {
    setRunning("send");
    const response = await fetch("/api/outreach/send-approved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, limit: dailyLimit })
    });
    const data = await response.json();
    setResult([`Attempted ${data.attempted}, sent ${data.sent}, skipped ${data.skipped}, failed ${data.failed}.`, ...(data.logs ?? [])]);
    setRunning(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Campaign workflow</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Campaign builder</h1>
      </header>

      <RegionTabs selected={region} onSelect={setRegion} />

      <section className="glass rounded-xl p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_260px]">
          <div>
            <h2 className="font-semibold text-white">Campaign controls</h2>
            <p className="mt-2 text-sm text-slate-400">Discovery keeps businesses with real website, SEO, GMB, or review opportunities and a usable contact path. Healthy low-opportunity businesses are rejected before they enter your pipeline.</p>
          </div>
          <label className="text-sm text-slate-300">
            Daily action limit
            <input
              type="number"
              min={1}
              max={150}
              value={dailyLimit}
              onChange={(event) => setDailyLimit(Math.max(1, Math.min(150, Number(event.target.value) || 1)))}
              className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300"
            />
          </label>
          <label className="text-sm text-slate-300">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300"
            />
          </label>
        </div>
        <label className="mt-4 block text-sm text-slate-300">
          Business categories
          <input
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300"
          />
        </label>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-white/6 p-3 soft-border">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <EventRepeatIcon fontSize="small" className="text-sky-200" />
              Day 1 outreach
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">Send approved personalized email or use contact-form queue when email is missing.</p>
          </div>
          <label className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">
            Follow-up delay
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={14}
                value={followUpDelay}
                onChange={(event) => setFollowUpDelay(Math.max(1, Math.min(14, Number(event.target.value) || 1)))}
                className="h-10 w-20 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300"
              />
              <span className="text-slate-400">days after first send</span>
            </div>
          </label>
          <label className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">
            Final follow-up
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={2}
                max={30}
                value={finalDelay}
                onChange={(event) => setFinalDelay(Math.max(2, Math.min(30, Number(event.target.value) || 2)))}
                className="h-10 w-20 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300"
              />
              <span className="text-slate-400">days before close loop</span>
            </div>
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <button onClick={runDiscovery} disabled={Boolean(running)} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
            <PlayArrowIcon />
            {running === "discover" ? "Running..." : "Find Leads"}
          </button>
          <button onClick={enrichLeads} disabled={Boolean(running)} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white/8 px-4 font-semibold text-white soft-border hover:bg-white/12 disabled:opacity-60">
            <ManageSearchIcon />
            {running === "enrich" ? "Enriching..." : "Enrich Details"}
          </button>
          <button onClick={discoverEmails} disabled={Boolean(running)} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white/8 px-4 font-semibold text-white soft-border hover:bg-white/12 disabled:opacity-60">
            <AlternateEmailIcon />
            {running === "emails" ? "Discovering..." : "Discover Emails"}
          </button>
          <button onClick={sendApproved} disabled={Boolean(running)} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400/14 px-4 font-semibold text-emerald-100 soft-border hover:bg-emerald-400/20 disabled:opacity-60">
            <SendIcon />
            {running === "send" ? "Sending..." : "Send Approved"}
          </button>
        </div>
      </section>

      {result.length > 0 && (
        <section className="glass rounded-xl p-5">
          <h2 className="mb-3 font-semibold text-white">Latest campaign activity</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {result.slice(0, 12).map((line) => (
              <div key={line} className="rounded-lg bg-black/20 p-3 text-sm text-slate-300 soft-border">{line}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
