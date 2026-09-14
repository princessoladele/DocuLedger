import { Body, Controller, Get, Ip, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser, AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../common/prisma/prisma.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshDto, @Ip() ip: string) {
    return this.authService.refresh(dto.refreshToken, ip);
  }

  @Public()
  @Post("logout")
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  @Get("me")
  async me(@CurrentUser() principal: AuthPrincipal) {
    if (principal.authType === "api_key") {
      return { authType: "api_key", organizationId: principal.organizationId, role: principal.role };
    }
    const user = await this.prisma.user.findUnique({
      where: { id: principal.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        organization: { select: { id: true, name: true, slug: true, plan: true } },
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return user;
  }
}
