import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SchemasService } from "./schemas.service";
import { CreateSchemaDto } from "./dto/create-schema.dto";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { MinRole } from "../../common/decorators/roles.decorator";

@ApiTags("schemas")
@Controller("schemas")
export class SchemasController {
  constructor(private readonly schemasService: SchemasService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal, @Query("industry") industry?: string): Promise<any> {
    return this.schemasService.list(principal.organizationId, industry);
  }

  @Get(":id")
  get(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string): Promise<any> {
    return this.schemasService.get(principal.organizationId, id);
  }

  @Post()
  @MinRole("ADMIN")
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateSchemaDto): Promise<any> {
    return this.schemasService.create(principal, dto);
  }

  @Patch(":id")
  @MinRole("ADMIN")
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param("id") id: string,
    @Body() dto: Partial<CreateSchemaDto>,
  ): Promise<any> {
    return this.schemasService.update(principal, id, dto);
  }
}
