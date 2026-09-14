import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@doculedger/shared";

export const OCR_QUEUE = "OCR_QUEUE";
export const ANCHOR_QUEUE = "ANCHOR_QUEUE";

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 3600 },
  removeOnFail: false,
};

@Global()
@Module({
  providers: [
    {
      provide: OCR_QUEUE,
      useFactory: (config: ConfigService) =>
        new Queue(QUEUE_NAMES.OCR_EXTRACTION, {
          connection: { url: config.get<string>("redis.url") } as any,
          defaultJobOptions,
        }),
      inject: [ConfigService],
    },
    {
      provide: ANCHOR_QUEUE,
      useFactory: (config: ConfigService) =>
        new Queue(QUEUE_NAMES.ANCHORING, {
          connection: { url: config.get<string>("redis.url") } as any,
          defaultJobOptions,
        }),
      inject: [ConfigService],
    },
  ],
  exports: [OCR_QUEUE, ANCHOR_QUEUE],
})
export class QueueModule {}
