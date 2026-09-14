/**
 * Central RBAC definition shared by the API (enforcement) and the web app
 * (conditional UI rendering). Roles are hierarchical/numeric: a higher role
 * implicitly holds every permission of the roles below it, PLUS whatever is
 * listed under its own key in `ROLE_PERMISSIONS`.
 */

export type Role = "MEMBER" | "REVIEWER" | "ADMIN" | "OWNER";

export const ROLE_RANK: Record<Role, number> = {
  MEMBER: 0,
  REVIEWER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export type Permission =
  | "document:upload"
  | "document:read:own"
  | "document:read:all"
  | "document:delete"
  | "review:read"
  | "review:approve"
  | "review:reject"
  | "schema:read"
  | "schema:write"
  | "user:invite"
  | "user:manage"
  | "apikey:manage"
  | "webhook:manage"
  | "audit:read"
  | "org:manage"
  | "org:billing";

/** Permissions granted additively at each role tier (cumulative upward). */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  MEMBER: ["document:upload", "document:read:own"],
  REVIEWER: ["document:read:all", "review:read", "review:approve", "review:reject"],
  ADMIN: [
    "document:delete",
    "schema:read",
    "schema:write",
    "user:invite",
    "user:manage",
    "apikey:manage",
    "webhook:manage",
    "audit:read",
  ],
  OWNER: ["org:manage", "org:billing"],
};

const ALL_ROLES: Role[] = ["MEMBER", "REVIEWER", "ADMIN", "OWNER"];

export function permissionsForRole(role: Role): Set<Permission> {
  const rank = ROLE_RANK[role];
  const perms = new Set<Permission>();
  for (const r of ALL_ROLES) {
    if (ROLE_RANK[r] <= rank) {
      ROLE_PERMISSIONS[r].forEach((p) => perms.add(p));
    }
  }
  return perms;
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).has(permission);
}

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
