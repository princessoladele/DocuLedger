import { SetMetadata } from "@nestjs/common";
import { Role } from "@doculedger/shared";

export const MIN_ROLE_KEY = "minRole";

/** Requires the caller's role to be at least `role` (see @doculedger/shared ROLE_RANK). */
export const MinRole = (role: Role) => SetMetadata(MIN_ROLE_KEY, role);
