import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";
import { listNotRespondedLeads } from "@/lib/notRespondedLeads";
import { NotRespondedLeadsWorkspace } from "@/components/lead/NotRespondedLeadsWorkspace";

export default async function NotRespondedPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/not-responded");
  if (!isOperationsRole(user.role)) redirect("/");
  const organizationId = user.organizationId;
  return <NotRespondedLeadsWorkspace initialLeads={await listNotRespondedLeads(organizationId)} />;
}
