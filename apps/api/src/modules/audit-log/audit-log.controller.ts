import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { MinRole } from "../../common/decorators/roles.decorator";

@ApiTags("audit-log")
@Controller("audit-log")
@MinRole("ADMIN")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(
    @CurrentUser() principal: AuthPrincipal,
    @Query("resourceType") resourceType?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ): Promise<any> {
    return this.auditLogService.list(principal.organizationId, {
      resourceType,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }
}
