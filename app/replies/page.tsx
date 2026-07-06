import { listDbReplies } from "@/lib/dbStore";
import { LiveReplyInbox } from "@/components/replies/LiveReplyInbox";

export default async function RepliesPage() {
  const replies = await listDbReplies();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <LiveReplyInbox initialReplies={replies.map((reply) => ({
        id: reply.id,
        fromEmail: reply.fromEmail,
        subject: reply.subject,
        body: reply.body,
        receivedAt: reply.receivedAt.toISOString()
      }))} />
    </div>
  );
}
