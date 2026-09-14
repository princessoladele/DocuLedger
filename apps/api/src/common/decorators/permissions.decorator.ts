import { SetMetadata } from "@nestjs/common";
import { Permission } from "@doculedger/shared";

export const PERMISSIONS_KEY = "permissions";

/** Requires the caller to hold ALL listed permissions (see @doculedger/shared rbac.ts). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
