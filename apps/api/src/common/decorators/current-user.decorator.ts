import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthPrincipal {
  /** User id when authenticated via JWT; the API key's id when authenticated via API key. */
  id: string;
  organizationId: string;
  role: "MEMBER" | "REVIEWER" | "ADMIN" | "OWNER";
  authType: "user" | "api_key";
  email?: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
  const request = ctx.switchToHttp().getRequest();
  return request.principal;
});
