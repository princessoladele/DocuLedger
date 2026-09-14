import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function makeContext(principal: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows a route with no metadata through regardless of role", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: "MEMBER" }))).toBe(true);
  });

  it("allows a MinRole('ADMIN') route for an OWNER (higher rank)", () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === "minRole" ? "ADMIN" : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: "OWNER" }))).toBe(true);
  });

  it("rejects a MinRole('ADMIN') route for a MEMBER", () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === "minRole" ? "ADMIN" : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: "MEMBER" }))).toThrow(ForbiddenException);
  });

  it("rejects when a required permission is missing for the role", () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === "permissions" ? ["schema:write"] : undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: "MEMBER" }))).toThrow(ForbiddenException);
  });

  it("allows when the caller holds the required permission", () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === "permissions" ? ["document:upload"] : undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: "MEMBER" }))).toBe(true);
  });

  it("throws ForbiddenException when there is no authenticated principal", () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === "minRole" ? "ADMIN" : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
