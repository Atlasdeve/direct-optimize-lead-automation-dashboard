"use client";

export function MilestoneStatusButton({ milestoneId, status }: { milestoneId: string; status: string }) {
  async function update() {
    await fetch(`/api/portal/milestones/${milestoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    window.location.reload();
  }

  return (
    <button onClick={update} className="rounded-md bg-white/8 px-2 py-1 text-xs text-slate-200 soft-border hover:bg-white/12">
      {status}
    </button>
  );
}
