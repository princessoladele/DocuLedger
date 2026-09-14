import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasPermission, Permission, Role, roleAtLeast } from "@doculedger/shared";
import { MIN_ROLE_KEY } from "../decorators/roles.decorator";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minRole = this.reflector.getAllAndOverride<Role>(MIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const permissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!minRole && !permissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const role: Role | undefined = request.principal?.role;
    if (!role) throw new ForbiddenException("No authenticated principal");

    if (minRole && !roleAtLeast(role, minRole)) {
      throw new ForbiddenException(`Requires role ${minRole} or higher`);
    }

    if (permissions?.length) {
      const missing = permissions.filter((p) => !hasPermission(role, p));
      if (missing.length) {
        throw new ForbiddenException(`Missing permissions: ${missing.join(", ")}`);
      }
    }

    return true;
  }
}
