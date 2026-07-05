import { clsx } from "clsx";

const colors: Record<string, string> = {
  New: "bg-sky-400/14 text-sky-100",
  Approved: "bg-cyan-400/14 text-cyan-100",
  Contacted: "bg-indigo-400/14 text-indigo-100",
  Replied: "bg-emerald-400/14 text-emerald-100",
  "Follow-up": "bg-amber-400/14 text-amber-100",
  "Meeting Booked": "bg-cyan-400/14 text-cyan-100",
  Closed: "bg-lime-400/14 text-lime-100",
  Failed: "bg-rose-400/14 text-rose-100"
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("inline-flex rounded-md px-2.5 py-1 text-xs font-medium soft-border", colors[status] ?? colors.New)}>
      {status}
    </span>
  );
}
