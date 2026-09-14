import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  summary(@CurrentUser() principal: AuthPrincipal) {
    return this.dashboardService.summary(principal.organizationId);
  }
}
