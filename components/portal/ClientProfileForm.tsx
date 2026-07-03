"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";

type ProfileProject = {
  id: string;
  companyName: string;
  websiteUrl?: string | null;
  gmbUrl?: string | null;
  additionalWebsiteUrls?: string[];
  additionalGmbUrls?: string[];
};

type ProfileUser = { name?: string | null; email: string; phone?: string | null; username?: string | null };

const inputClass = "mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300";

export function ClientProfileForm({ user, projects }: { user: ProfileUser; projects: ProfileProject[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const project = useMemo(() => projects.find((item) => item.id === projectId) ?? projects[0], [projectId, projects]);
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(project?.websiteUrl ?? "");
  const [gmbUrl, setGmbUrl] = useState(project?.gmbUrl ?? "");
  const [websiteUrls, setWebsiteUrls] = useState(project?.additionalWebsiteUrls ?? []);
  const [gmbUrls, setGmbUrls] = useState(project?.additionalGmbUrls ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectProject(id: string) {
    const selected = projects.find((item) => item.id === id);
    setProjectId(id);
    setWebsiteUrl(selected?.websiteUrl ?? "");
    setGmbUrl(selected?.gmbUrl ?? "");
    setWebsiteUrls(selected?.additionalWebsiteUrls ?? []);
    setGmbUrls(selected?.additionalGmbUrls ?? []);
    setMessage(null);
    setError(null);
  }

  function updateLink(kind: "website" | "gmb", index: number, value: string) {
    const setter = kind === "website" ? setWebsiteUrls : setGmbUrls;
    setter((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function removeLink(kind: "website" | "gmb", index: number) {
    const setter = kind === "website" ? setWebsiteUrls : setGmbUrls;
    setter((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name, email, phone, websiteUrl, gmbUrl, additionalWebsiteUrls: websiteUrls, additionalGmbUrls: gmbUrls })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Profile could not be updated.");
      return;
    }
    setMessage("Profile updated successfully.");
    router.refresh();
  }

  if (!project) return <div className="glass rounded-lg p-5 text-sm text-slate-300">No client project is connected to your account yet.</div>;

  return (
    <form onSubmit={submit} className="glass space-y-7 rounded-lg p-5 sm:p-7">
      {projects.length > 1 && <label className="block text-sm font-medium text-slate-300">Project
        <select value={projectId} onChange={(event) => selectProject(event.target.value)} className={`${inputClass} bg-[#091629]`}>
          {projects.map((item) => <option key={item.id} value={item.id}>{item.companyName}</option>)}
        </select>
      </label>}

      <section>
        <h2 className="text-lg font-semibold text-white">Contact information</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">Name
            <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </label>
          <label className="text-sm font-medium text-slate-300">Username
            <input disabled value={user.username ?? ""} className={`${inputClass} cursor-not-allowed opacity-60`} />
          </label>
          <label className="text-sm font-medium text-slate-300">Email
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
          </label>
          <label className="text-sm font-medium text-slate-300">Phone number
            <input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      <section className="border-t border-line pt-6">
        <h2 className="text-lg font-semibold text-white">Primary business properties</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">Primary website URL
            <input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.com" className={inputClass} />
          </label>
          <label className="text-sm font-medium text-slate-300">Primary GMB URL
            <input type="url" value={gmbUrl} onChange={(event) => setGmbUrl(event.target.value)} placeholder="https://maps.google.com/..." className={inputClass} />
          </label>
        </div>
      </section>

      <UrlList title="Additional websites" values={websiteUrls} kind="website" onAdd={() => setWebsiteUrls((current) => current.length < 10 ? [...current, ""] : current)} onChange={updateLink} onRemove={removeLink} />
      <UrlList title="Additional Google Business Profiles" values={gmbUrls} kind="gmb" onAdd={() => setGmbUrls((current) => current.length < 10 ? [...current, ""] : current)} onChange={updateLink} onRemove={removeLink} />

      {error && <div className="rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{error}</div>}
      {message && <div className="rounded-lg bg-emerald-400/12 p-3 text-sm text-emerald-100 soft-border">{message}</div>}
      <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
        <SaveIcon fontSize="small" />{busy ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}

function UrlList({ title, values, kind, onAdd, onChange, onRemove }: {
  title: string;
  values: string[];
  kind: "website" | "gmb";
  onAdd: () => void;
  onChange: (kind: "website" | "gmb", index: number, value: string) => void;
  onRemove: (kind: "website" | "gmb", index: number) => void;
}) {
  return <section className="border-t border-line pt-6">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <button type="button" onClick={onAdd} disabled={values.length >= 10} title={`Add ${kind} link`} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-sky-100 soft-border hover:bg-white/7 disabled:opacity-40">
        <AddIcon fontSize="small" /> Add link
      </button>
    </div>
    {values.length === 0 ? <p className="mt-3 text-sm text-slate-500">No additional links added.</p> : <div className="mt-4 space-y-3">
      {values.map((value, index) => <div key={`${kind}-${index}`} className="flex items-center gap-2">
        <input required type="url" value={value} onChange={(event) => onChange(kind, index, event.target.value)} placeholder={kind === "website" ? "https://example.com" : "https://maps.google.com/..."} className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
        <button type="button" onClick={() => onRemove(kind, index)} title="Remove link" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-rose-200 soft-border hover:bg-rose-400/10">
          <DeleteOutlineIcon fontSize="small" />
        </button>
      </div>)}
    </div>}
  </section>;
}
