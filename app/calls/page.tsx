import Link from "next/link";
import { redirect } from "next/navigation";
import CallIcon from "@mui/icons-material/Call";
import QueryBuilderIcon from "@mui/icons-material/QueryBuilder";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { currentUser } from "@/lib/auth";
import { listRecentCallLogs } from "@/lib/callStore";

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export default async function CallsPage() {
  const user = await currentUser();
  if (!user || !["admin", "employee"].includes(user.role)) redirect("/");
  const calls = (await listRecentCallLogs()).filter(Boolean);
  const totalSeconds = calls.reduce((sum, call) => sum + (call?.durationSeconds ?? 0), 0);
  const positive = calls.filter((call) => ["Interested", "Qualified", "Callback"].includes(call?.outcome ?? "")).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="text-sm font-medium text-emerald-200">Sales activity</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Calls</h1>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="glass rounded-xl p-5"><CallIcon className="text-sky-200" /><div className="mt-3 text-sm text-slate-400">Logged calls</div><div className="mt-1 text-3xl font-semibold text-white">{calls.length}</div></div>
        <div className="glass rounded-xl p-5"><QueryBuilderIcon className="text-amber-200" /><div className="mt-3 text-sm text-slate-400">Talk time</div><div className="mt-1 text-3xl font-semibold text-white">{durationLabel(totalSeconds)}</div></div>
        <div className="glass rounded-xl p-5"><TaskAltIcon className="text-emerald-200" /><div className="mt-3 text-sm text-slate-400">Positive outcomes</div><div className="mt-1 text-3xl font-semibold text-white">{positive}</div></div>
      </section>

      <section className="glass rounded-xl p-5">
        <h2 className="font-semibold text-white">Recent call activity</h2>
        {calls.length === 0 ? <div className="mt-4 rounded-lg bg-white/6 p-4 text-sm text-slate-400 soft-border">No calls have been logged yet.</div> : (
          <div className="mt-4 space-y-3">
            {calls.map((call) => call && (() => {
              const content = (
                <>
                <div><div className="font-semibold text-white">{call.companyName}</div><div className="mt-1 text-xs text-slate-400">{call.region} · {call.agent}</div></div>
                <div><div className="text-xs text-slate-500">Outcome</div><div className="mt-1 text-sm text-slate-200">{call.outcome || call.status}</div></div>
                <div><div className="text-xs text-slate-500">Duration</div><div className="mt-1 text-sm text-slate-200">{durationLabel(call.durationSeconds ?? 0)}</div></div>
                <div className="text-xs text-slate-500 md:text-right">{new Date(call.createdAt ?? 0).toLocaleString()}</div>
                </>
              );
              const className = "grid gap-3 rounded-lg bg-white/6 p-4 soft-border md:grid-cols-[1fr_160px_140px_180px] md:items-center";
              return call.leadId
                ? <Link key={call.id} href={`/leads/${call.leadId}`} className={`${className} hover:bg-white/9`}>{content}</Link>
                : <div key={call.id} className={className}>{content}</div>;
            })())}
          </div>
        )}
      </section>
    </div>
  );
}
