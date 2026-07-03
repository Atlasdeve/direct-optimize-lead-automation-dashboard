"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";

type EmployeeOption = { id: string; name?: string | null; email: string };

export function ProjectAssignmentControl({ projectId, currentEmployeeId }: { projectId: string; currentEmployeeId?: string | null }) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeUserId, setEmployeeUserId] = useState(currentEmployeeId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/users?role=employee")
      .then((response) => response.json())
      .then((data) => setEmployees(data.users ?? []));
  }, []);

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/portal/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeUserId })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? employeeUserId ? "Employee assigned successfully." : "Employee assignment removed." : data.error ?? "Assignment could not be updated.");
    if (response.ok) router.refresh();
  }

  return <section className="glass rounded-lg p-5">
    <div className="flex items-center gap-2 text-white"><AssignmentIndIcon fontSize="small" /><h2 className="font-semibold">Employee assignment</h2></div>
    <form onSubmit={assign} className="mt-4 flex flex-col gap-3 sm:flex-row">
      <select value={employeeUserId} onChange={(event) => setEmployeeUserId(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-[#091629] px-3 text-white outline-none focus:border-sky-300">
        <option value="">Unassigned</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name || employee.email}</option>)}
      </select>
      <button disabled={busy} className="h-11 rounded-lg bg-sky-400 px-5 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">{busy ? "Saving..." : "Save assignment"}</button>
    </form>
    {message && <div className="mt-3 text-sm text-slate-300">{message}</div>}
  </section>;
}
