export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtlDays: number;
  };
  database: { url: string };
  redis: { url: string };
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
  rateLimit: { ttlSeconds: number; limit: number };
  confidenceThreshold: number;
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(","),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
  },
  database: {
    url: process.env.DATABASE_URL ?? "postgresql://doculedger:doculedger@localhost:5432/doculedger",
  },
  redis: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT ?? "http://localhost:9000",
    region: process.env.STORAGE_REGION ?? "us-east-1",
    bucket: process.env.STORAGE_BUCKET ?? "doculedger-documents",
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "doculedger",
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "doculedger-secret",
    forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
  },
  rateLimit: {
    ttlSeconds: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60),
    limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
  },
  confidenceThreshold: Number(process.env.DEFAULT_CONFIDENCE_THRESHOLD ?? 0.85),
});
