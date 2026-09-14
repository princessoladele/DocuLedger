import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Thin wrapper around an S3-compatible object store (MinIO in dev/docker
 * compose, AWS S3 in production). Documents are stored under
 * `<orgId>/<documentId>/<filename>` and encrypted at rest via the bucket's
 * server-side encryption (SSE-S3/SSE-KMS, configured on the bucket, not
 * here) — the API never persists document bytes anywhere else.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>("storage.bucket")!;
    this.client = new S3Client({
      endpoint: this.config.get<string>("storage.endpoint"),
      region: this.config.get<string>("storage.region"),
      forcePathStyle: this.config.get<boolean>("storage.forcePathStyle"),
      credentials: {
        accessKeyId: this.config.get<string>("storage.accessKeyId")!,
        secretAccessKey: this.config.get<string>("storage.secretAccessKey")!,
      },
    });
  }

  buildKey(organizationId: string, documentId: string, filename: string): string {
    return `${organizationId}/${documentId}/${filename}`;
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    // Encryption at rest is enforced by the bucket's own default encryption
    // configuration (see infra docs), not a per-request header here — that
    // keeps this working identically against AWS S3 (SSE-S3/SSE-KMS) and
    // S3-compatible stores like MinIO that don't honor a request-level
    // ServerSideEncryption header without their own KMS backend configured.
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
