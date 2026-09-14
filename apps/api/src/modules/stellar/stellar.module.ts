import { Module } from "@nestjs/common";
import { StellarController } from "./stellar.controller";
import { StellarService } from "./stellar.service";

@Module({
  controllers: [StellarController],
  providers: [StellarService],
})
export class StellarModule {}
