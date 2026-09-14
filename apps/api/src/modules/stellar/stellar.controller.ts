import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { StellarService } from "./stellar.service";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";

@ApiTags("stellar")
@Controller("stellar")
export class StellarController {
  constructor(private readonly stellarService: StellarService) {}

  @Get("verify/:documentId")
  verify(@CurrentUser() principal: AuthPrincipal, @Param("documentId") documentId: string) {
    return this.stellarService.verifyDocument(principal, documentId);
  }
}
