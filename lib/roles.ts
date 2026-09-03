export const authenticatedRoles = ["super_admin", "admin", "manager", "employee", "client"] as const;

export function isSuperAdminRole(role?: string | null) {
  return role === "super_admin";
}

export function isAdminRole(role?: string | null) {
  return role === "super_admin" || role === "admin";
}

export function isOperationsRole(role?: string | null) {
  return role === "super_admin" || role === "admin" || role === "manager";
}
