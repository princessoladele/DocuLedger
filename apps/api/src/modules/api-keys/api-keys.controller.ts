import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { MinRole } from "../../common/decorators/roles.decorator";

@ApiTags("api-keys")
@Controller("api-keys")
@MinRole("ADMIN")
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(principal, dto);
  }

  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.apiKeysService.list(principal.organizationId);
  }

  @Delete(":id")
  revoke(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string) {
    return this.apiKeysService.revoke(principal, id);
  }
}
