import { redirect } from "next/navigation";
import { FollowUpRemindersWorkspace } from "@/components/lead/FollowUpRemindersWorkspace";
import { currentUser } from "@/lib/auth";
import { listFollowUpReminders } from "@/lib/followUpReminders";
import { isOperationsRole } from "@/lib/roles";

export default async function FollowUpRemindersPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/follow-up-reminders");
  if (!isOperationsRole(user.role)) redirect("/");
  const organizationId = user.organizationId;
  const reminders = await listFollowUpReminders(organizationId);
  return <FollowUpRemindersWorkspace initialReminders={reminders} />;
}
