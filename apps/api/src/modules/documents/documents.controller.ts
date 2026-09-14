import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { DocumentsService } from "./documents.service";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { MinRole } from "../../common/decorators/roles.decorator";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @RequirePermissions("document:upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @CurrentUser() principal: AuthPrincipal,
    @UploadedFile() file: Express.Multer.File,
    @Body("schemaId") schemaId: string | undefined,
    @Body("industry") industry: string | undefined,
    @Ip() ip: string,
  ): Promise<any> {
    return this.documentsService.upload(principal, file, { schemaId, industry }, ip);
  }

  @Get()
  list(
    @CurrentUser() principal: AuthPrincipal,
    @Query("status") status?: string,
    @Query("industry") industry?: string,
    @Query("schemaId") schemaId?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ): Promise<any> {
    return this.documentsService.list(principal, {
      status,
      industry,
      schemaId,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(":id")
  get(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string): Promise<any> {
    return this.documentsService.get(principal, id);
  }

  @Get(":id/download-url")
  getDownloadUrl(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string) {
    return this.documentsService.getDownloadUrl(principal, id);
  }

  @Post(":id/retry")
  retry(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string) {
    return this.documentsService.retry(principal, id);
  }

  @Delete(":id")
  @MinRole("ADMIN")
  remove(@CurrentUser() principal: AuthPrincipal, @Param("id") id: string) {
    return this.documentsService.remove(principal, id);
  }
}
