import { listDbReplies } from "@/lib/dbStore";
import { classifyReply, replyClassificationLabel } from "@/lib/replyClassifier";

export default async function RepliesPage() {
  const replies = await listDbReplies();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-3xl font-semibold text-white">Inbox replies</h1>
      <div className="space-y-4">
        {replies.map((reply) => (
          <div key={reply.id} className="glass rounded-xl p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="font-semibold text-white">{reply.subject}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-white/7 px-3 py-1 text-xs capitalize text-sky-100 soft-border">
                  {replyClassificationLabel(classifyReply(reply.subject ?? "", reply.body))}
                </span>
                <div className="text-sm text-slate-400">{reply.receivedAt.toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-400">{reply.fromEmail}</div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{reply.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
