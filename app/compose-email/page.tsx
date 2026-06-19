import { ComposeEmailForm } from "@/components/ComposeEmailForm";
import { listComposeEmailLogs } from "@/lib/dbStore";

export default async function ComposeEmailPage() {
  const logs = await listComposeEmailLogs();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Manual outreach</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Compose email</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Write and send a custom email using the Direct Optimize branded template.
        </p>
      </header>
      <ComposeEmailForm />
      <section className="glass rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-semibold text-white">Compose tracking</h2>
            <p className="mt-1 text-sm text-slate-400">Recent manual emails with open and click activity.</p>
          </div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Last 12 sends</div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <div className="grid min-w-[900px] grid-cols-[1.3fr_1.5fr_0.7fr_0.5fr_0.5fr_1fr] gap-3 bg-white/6 px-4 py-3 text-xs font-semibold uppercase text-slate-400">
            <div>Recipient</div>
            <div>Subject</div>
            <div>Status</div>
            <div>Opens</div>
            <div>Clicks</div>
            <div>Last activity</div>
          </div>
          {logs.length ? logs.map((log) => {
            const lastActivity = log.lastClickedAt ?? log.lastOpenedAt ?? log.createdAt;
            return (
              <div key={log.id} className="grid min-w-[900px] grid-cols-[1.3fr_1.5fr_0.7fr_0.5fr_0.5fr_1fr] gap-3 border-t border-line px-4 py-3 text-sm text-slate-300">
                <div className="truncate text-white">{log.toEmail}</div>
                <div className="truncate">{log.subject}</div>
                <div className="capitalize">{log.status}</div>
                <div className="font-semibold text-white">{log.openCount}</div>
                <div className="font-semibold text-white">{log.clickCount}</div>
                <div>{new Date(lastActivity).toLocaleString()}</div>
              </div>
            );
          }) : (
            <div className="border-t border-line px-4 py-6 text-sm text-slate-400">No composed emails sent yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
