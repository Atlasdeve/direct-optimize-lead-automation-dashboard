"use client";

import { MilestoneStatusButton } from "@/components/portal/MilestoneStatusButton";

type WorkLog = {
  id: string;
  title: string;
  summary: string;
  changesMade: string;
  timeMinutes: number;
  screenshotUrls: string[];
  clientVisible: boolean;
  createdAt: string;
  employee?: { name?: string | null; email?: string | null } | null;
};

type ProjectComment = {
  id: string;
  body: string;
  type: string;
  approved: boolean;
  clientVisible: boolean;
  createdAt: string;
  author?: { name?: string | null; email?: string | null; role?: string | null } | null;
};

type ProjectMilestone = {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  status: string;
  dueDate?: string | null;
  completedAt?: string | null;
};

type ProjectSnapshot = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  screenshotUrls: string[];
  createdAt: string;
};

type WeeklyReport = {
  id: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  wins: string[];
  nextSteps: string[];
  totalMinutes: number;
  createdAt: string;
};

export type PortalProject = {
  id: string;
  companyName: string;
  websiteUrl?: string | null;
  gmbUrl?: string | null;
  status: string;
  progress: number;
  totalHours: number;
  totalMinutes: number;
  estimatedMinutes: number;
  notes?: string | null;
  client?: { name?: string | null; email?: string | null } | null;
  employee?: { name?: string | null; email?: string | null } | null;
  daily: Array<{ date: string; minutes: number; logs: number }>;
  workLogs: WorkLog[];
  comments: ProjectComment[];
  milestones: ProjectMilestone[];
  snapshots: ProjectSnapshot[];
  weeklyReports: WeeklyReport[];
};

export function ProjectProgressView({ project, viewer = "admin" }: { project: PortalProject; viewer?: "admin" | "employee" | "client" }) {
  const maxDaily = Math.max(1, ...project.daily.map((row) => row.minutes));
  const estimated = Math.max(project.estimatedMinutes, project.totalMinutes, 1);
  const timeProgress = Math.round((project.totalMinutes / estimated) * 100);

  return (
    <div className="space-y-5">
      <section className="glass rounded-xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-medium text-sky-200">{viewer === "client" ? "Client progress portal" : "Delivery progress"}</div>
            <h1 className="mt-2 text-4xl font-semibold text-white">{project.companyName}</h1>
            <p className="mt-2 text-sm text-slate-400">{project.status}</p>
          </div>
          <div className="rounded-lg bg-emerald-400/12 px-4 py-3 text-right soft-border">
            <div className="text-xs text-emerald-100">Progress</div>
            <div className="text-3xl font-semibold text-white">{project.progress}%</div>
          </div>
        </div>
        <div className="mt-5 h-3 rounded-full bg-white/10">
          <div className="h-3 rounded-full bg-sky-300" style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-slate-400">Time spent</div>
          <div className="mt-2 text-3xl font-semibold text-white">{project.totalHours}h</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-slate-400">Work entries</div>
          <div className="mt-2 text-3xl font-semibold text-white">{project.workLogs.length}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-slate-400">Time utilization</div>
          <div className="mt-2 text-3xl font-semibold text-white">{timeProgress}%</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-slate-400">Assigned specialist</div>
          <div className="mt-2 text-sm font-semibold text-white">{project.employee?.name || project.employee?.email || "Pending"}</div>
        </div>
      </section>

      <section className="glass rounded-xl p-5">
        <h2 className="font-semibold text-white">Progress graph</h2>
        <div className="mt-4 flex h-44 items-end gap-2 rounded-lg bg-black/20 p-4 soft-border">
          {project.daily.length === 0 && <div className="text-sm text-slate-400">No daily work submitted yet.</div>}
          {project.daily.map((row) => (
            <div key={row.date} className="flex h-full flex-1 flex-col justify-end gap-2">
              <div className="rounded-t-md bg-sky-300" style={{ height: `${Math.max(8, (row.minutes / maxDaily) * 100)}%` }} />
              <div className="truncate text-center text-[10px] text-slate-500">{row.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold text-white">Project assets</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-lg bg-white/6 p-3 soft-border">Website: {project.websiteUrl || "Pending"}</div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">GMB URL: {project.gmbUrl || "Pending"}</div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">Client: {project.client?.name || project.client?.email || "Pending"}</div>
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold text-white">Work timeline</h2>
          <div className="mt-4 space-y-3">
            {project.workLogs.length === 0 && <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">No progress updates yet.</div>}
            {project.workLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-white/6 p-4 soft-border">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold text-white">{log.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()} · {log.timeMinutes} minutes</div>
                  </div>
                  <div className="text-xs text-slate-400">{log.employee?.name || log.employee?.email || "Team"}</div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{log.summary}</p>
                <div className="mt-3 rounded-lg bg-black/20 p-3 text-sm leading-6 text-slate-300">{log.changesMade}</div>
                {log.screenshotUrls.length > 0 && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {log.screenshotUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-lg bg-sky-400/10 p-2 text-xs text-sky-100 soft-border hover:bg-sky-400/15">
                        Screenshot proof
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold text-white">Approvals and comments</h2>
          <div className="mt-4 space-y-3">
            {project.comments.length === 0 && <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">No client comments or approvals yet.</div>}
            {project.comments.map((comment) => (
              <div key={comment.id} className={comment.approved ? "rounded-lg bg-emerald-400/12 p-3 soft-border" : "rounded-lg bg-white/6 p-3 soft-border"}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{comment.approved ? "Approved" : comment.type}</span>
                  <span className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{comment.body}</p>
                <div className="mt-2 text-xs text-slate-500">{comment.author?.name || comment.author?.email || "Portal user"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold text-white">Invoice milestones</h2>
          <div className="mt-4 space-y-3">
            {project.milestones.length === 0 && <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">No milestones yet.</div>}
            {project.milestones.map((milestone) => (
              <div key={milestone.id} className="rounded-lg bg-white/6 p-3 soft-border">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{milestone.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : "No due date"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-sky-100">${milestone.amount}</div>
                    <div className="text-xs text-slate-500">{milestone.status}</div>
                  </div>
                </div>
                {milestone.description && <p className="mt-2 text-sm text-slate-300">{milestone.description}</p>}
                {viewer === "admin" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MilestoneStatusButton milestoneId={milestone.id} status="Pending" />
                    <MilestoneStatusButton milestoneId={milestone.id} status="Invoiced" />
                    <MilestoneStatusButton milestoneId={milestone.id} status="Paid" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold text-white">Weekly reports</h2>
          <div className="mt-4 space-y-3">
            {project.weeklyReports.length === 0 && <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">No weekly reports generated yet.</div>}
            {project.weeklyReports.map((report) => (
              <div key={report.id} className="rounded-lg bg-white/6 p-3 soft-border">
                <div className="text-xs text-slate-500">{new Date(report.weekStart).toLocaleDateString()} - {new Date(report.weekEnd).toLocaleDateString()}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{report.summary}</p>
                <div className="mt-2 text-xs text-sky-100">{Math.round((report.totalMinutes / 60) * 10) / 10}h reported</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass rounded-xl p-5">
        <h2 className="font-semibold text-white">Before / after snapshots</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {project.snapshots.length === 0 && <div className="rounded-lg bg-white/6 p-3 text-sm text-slate-300 soft-border">No snapshots yet.</div>}
          {project.snapshots.map((snapshot) => (
            <div key={snapshot.id} className="rounded-lg bg-white/6 p-4 soft-border">
              <div className="text-xs uppercase text-sky-200">{snapshot.kind}</div>
              <div className="mt-1 font-semibold text-white">{snapshot.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{snapshot.summary}</p>
              {snapshot.screenshotUrls.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {snapshot.screenshotUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg bg-black/20 soft-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={snapshot.title} className="h-28 w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
