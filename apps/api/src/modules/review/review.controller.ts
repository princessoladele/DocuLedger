import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReviewService } from "./review.service";
import { ApproveReviewDto, RejectReviewDto } from "./dto/decide-review.dto";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { MinRole } from "../../common/decorators/roles.decorator";

@ApiTags("review")
@Controller("review")
@MinRole("REVIEWER")
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal, @Query("status") status?: string): Promise<any> {
    return this.reviewService.list(principal.organizationId, status);
  }

  @Get(":id")
  get(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string): Promise<any> {
    return this.reviewService.get(principal.organizationId, id);
  }

  @Post(":id/approve")
  approve(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string, @Body() dto: ApproveReviewDto) {
    return this.reviewService.approve(principal, id, dto);
  }

  @Post(":id/reject")
  reject(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string, @Body() dto: RejectReviewDto) {
    return this.reviewService.reject(principal, id, dto);
  }
}
