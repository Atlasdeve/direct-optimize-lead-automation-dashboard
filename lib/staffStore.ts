import { prisma } from "@/lib/prisma";
import { createPortalUser } from "@/lib/portalStore";

export type StaffRole = "admin" | "manager";

export async function listStaffAccounts() {
  return prisma.user.findMany({
    where: { role: { in: ["admin", "manager"] } },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }]
  });
}

export async function createStaffAccount(input: {
  email: string;
  username?: string;
  name?: string;
  password: string;
  role: StaffRole;
}) {
  if (!["admin", "manager"].includes(input.role)) throw new Error("Select Administrator or Manager.");
  return createPortalUser(input);
}
