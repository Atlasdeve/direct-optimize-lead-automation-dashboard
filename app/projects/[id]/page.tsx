import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/portalStore";
import { LiveProjectProgress } from "@/components/portal/LiveProjectProgress";
import { WorkLogForm } from "@/components/portal/WorkLogForm";
import { TrustLayerForms } from "@/components/portal/TrustLayerForms";
import { ProjectAssignmentControl } from "@/components/portal/ProjectAssignmentControl";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProjectForUser(id, user);
  if (!project) redirect(user.role === "client" ? "/client-portal" : user.role === "employee" ? "/employee-portal" : "/projects");
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {user.role === "admin" && <ProjectAssignmentControl projectId={project.id} currentEmployeeId={project.employee?.id} />}
      {(user.role === "admin" || user.role === "employee") && <WorkLogForm projectId={project.id} />}
      <TrustLayerForms projectId={project.id} role={user.role} />
      <LiveProjectProgress initialProject={project} viewer={user.role === "client" ? "client" : user.role === "employee" ? "employee" : "admin"} />
    </div>
  );
}
