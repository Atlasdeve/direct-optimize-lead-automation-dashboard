import { listDbAiDrafts } from "@/lib/dbStore";

export default async function AiDraftsPage() {
  const drafts = await listDbAiDrafts();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-3xl font-semibold text-white">AI reply drafts</h1>
      <div className="space-y-4">
        {drafts.map((draft) => (
          <div key={draft.id} className="glass rounded-xl p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="font-semibold text-white">{draft.lead.companyName}</div>
              <div className="rounded-md bg-amber-400/12 px-3 py-1 text-sm text-amber-100 soft-border">{draft.status}</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{draft.draft}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
