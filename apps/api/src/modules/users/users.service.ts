import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { InviteUserDto } from "./dto/invite-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async invite(principal: AuthPrincipal, dto: InviteUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { organizationId: principal.organizationId, email: dto.email },
    });
    if (existing) throw new ConflictException("A user with this email already exists in your organization");

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    const user = await this.prisma.user.create({
      data: {
        organizationId: principal.organizationId,
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
      },
    });

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.id,
      actorType: "USER",
      action: "user.invite",
      resourceType: "user",
      resourceId: user.id,
      metadata: { email: dto.email, role: dto.role },
    });

    const { passwordHash: _omit, ...safe } = user;
    return safe;
  }

  async update(principal: AuthPrincipal, targetUserId: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: principal.organizationId },
    });
    if (!target) throw new NotFoundException("User not found");
    if (target.id === principal.id && dto.role && dto.role !== target.role) {
      throw new ForbiddenException("You cannot change your own role");
    }

    const updated = await this.prisma.user.update({ where: { id: targetUserId }, data: dto });

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.id,
      actorType: "USER",
      action: "user.update",
      resourceType: "user",
      resourceId: targetUserId,
      metadata: dto as Record<string, unknown>,
    });

    const { passwordHash: _omit, ...safe } = updated;
    return safe;
  }
}
