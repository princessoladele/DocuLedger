import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { InviteUserDto } from "./dto/invite-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { MinRole } from "../../common/decorators/roles.decorator";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @MinRole("REVIEWER")
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.usersService.list(principal.organizationId);
  }

  @Post("invite")
  @MinRole("ADMIN")
  invite(@CurrentUser() principal: AuthPrincipal, @Body() dto: InviteUserDto) {
    return this.usersService.invite(principal, dto);
  }

  @Patch(":id")
  @MinRole("ADMIN")
  update(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(principal, id, dto);
  }
}
