import { prisma } from "@/lib/prisma";
import { createAppNotification } from "@/lib/appNotifications";

export async function sendDailyEmployeeWorkReminders(now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const employees = await prisma.user.findMany({
    where: {
      role: "employee",
      assignedProjects: {
        some: {
          status: { notIn: ["Completed", "Cancelled", "Archived"] },
          workLogs: { none: { createdAt: { gte: dayStart } } }
        }
      }
    },
    select: {
      id: true,
      assignedProjects: {
        where: {
          status: { notIn: ["Completed", "Cancelled", "Archived"] },
          workLogs: { none: { createdAt: { gte: dayStart } } }
        },
        select: { id: true, companyName: true },
        take: 5
      }
    }
  });

  let sent = 0;
  for (const employee of employees) {
    const alreadySent = await prisma.notification.findFirst({
      where: { recipientUserId: employee.id, type: "employee_work_reminder", createdAt: { gte: dayStart } },
      select: { id: true }
    });
    if (alreadySent || employee.assignedProjects.length === 0) continue;
    const firstProject = employee.assignedProjects[0];
    const remaining = employee.assignedProjects.length - 1;
    await createAppNotification({
      recipientUserId: employee.id,
      type: "employee_work_reminder",
      title: "Daily work update pending",
      message: remaining > 0
        ? `${firstProject.companyName} and ${remaining} other project${remaining === 1 ? "" : "s"} still need today's update.`
        : `${firstProject.companyName} still needs today's work update.`,
      actionUrl: `/projects/${firstProject.id}`
    });
    sent += 1;
  }
  return { sent };
}
