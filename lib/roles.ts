export const authenticatedRoles = ["admin", "manager", "employee", "client"] as const;

export function isAdminRole(role?: string | null) {
  return role === "admin";
}

export function isOperationsRole(role?: string | null) {
  return role === "admin" || role === "manager";
}
