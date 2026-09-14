import { Module } from "@nestjs/common";
import { AuditLogController } from "./audit-log.controller";

// AuditLogService itself is provided globally by common/audit/audit-log.module.
@Module({
  controllers: [AuditLogController],
})
export class AuditLogFeatureModule {}
