import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuditLogModule } from "./common/audit/audit-log.module";
import { StorageModule } from "./common/storage/storage.module";
import { QueueModule } from "./common/queue/queue.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { AuthGuard } from "./common/guards/auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";

import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ApiKeysModule } from "./modules/api-keys/api-keys.module";
import { SchemasModule } from "./modules/schemas/schemas.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { ReviewModule } from "./modules/review/review.module";
import { AuditLogFeatureModule } from "./modules/audit-log/audit-log.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { StellarModule } from "./modules/stellar/stellar.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>("rateLimit.ttlSeconds")! * 1000,
          limit: config.get<number>("rateLimit.limit")!,
        },
      ],
    }),
    PrismaModule,
    AuditLogModule,
    StorageModule,
    QueueModule,
    AuthModule,
    UsersModule,
    ApiKeysModule,
    SchemasModule,
    DocumentsModule,
    ReviewModule,
    AuditLogFeatureModule,
    DashboardModule,
    StellarModule,
    HealthModule,
  ],
  providers: [
    JwtService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
