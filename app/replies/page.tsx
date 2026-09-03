import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listDbReplies } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";
import { LiveReplyInbox } from "@/components/replies/LiveReplyInbox";

export default async function RepliesPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/replies");
  if (!isOperationsRole(user.role)) redirect("/");
  const organizationId = user.organizationId;
  const replies = await listDbReplies(organizationId);
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
