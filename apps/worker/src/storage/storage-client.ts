import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Minimal read-side object store client. The worker only ever reads
 * documents that the API already stored (encrypted at rest via the
 * bucket's SSE config) — it never writes originals, only derived
 * artifacts stay in Postgres (extracted fields, not files).
 */
export class StorageClient {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET ?? "doculedger-documents";
    this.client = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT ?? "http://localhost:9000",
      region: process.env.STORAGE_REGION ?? "us-east-1",
      forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "doculedger",
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "doculedger-secret",
      },
    });
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
