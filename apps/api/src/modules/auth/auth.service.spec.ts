import { ConflictException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "jwt.accessSecret": "test-access-secret",
    "jwt.accessTtl": "15m",
    "jwt.refreshSecret": "test-refresh-secret",
    "jwt.refreshTtlDays": 30,
    ...overrides,
  };
  return { get: (key: string) => values[key] } as any;
}

describe("AuthService", () => {
  let prisma: any;
  let jwt: any;
  let audit: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      organization: { create: jest.fn(), findUnique: jest.fn() },
      refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    jwt = {
      sign: jest.fn((payload: any) => `signed.${payload.sub}.${payload.jti ?? "access"}`),
      verify: jest.fn(),
    };
    audit = { record: jest.fn() };
    service = new AuthService(prisma, jwt, makeConfig(), audit);
  });

  describe("register", () => {
    it("rejects a duplicate email", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "existing" });
      await expect(
        service.register({ organizationName: "Acme", email: "a@acme.com", name: "A", password: "verylongpassword" }),
      ).rejects.toThrow(ConflictException);
    });

    it("creates an organization + OWNER user and returns tokens", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue({ id: "org-1", name: "Acme", slug: "acme" });
      prisma.user.create.mockResolvedValue({
        id: "user-1",
        organizationId: "org-1",
        email: "a@acme.com",
        name: "A",
        role: "OWNER",
        passwordHash: "hash",
      });

      const result = await service.register({
        organizationName: "Acme",
        email: "a@acme.com",
        name: "A",
        password: "verylongpassword",
      });

      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: "acme" }) }),
      );
      expect(result.user).not.toHaveProperty("passwordHash");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.register" }));
    });
  });

  describe("login", () => {
    it("rejects an unknown email", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login({ email: "nobody@acme.com", password: "x" })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects a wrong password", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 4);
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        organizationId: "org-1",
        isActive: true,
        passwordHash,
        role: "MEMBER",
      });
      await expect(service.login({ email: "a@acme.com", password: "wrong-password" })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("issues tokens for a correct password", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 4);
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        organizationId: "org-1",
        isActive: true,
        passwordHash,
        role: "MEMBER",
        email: "a@acme.com",
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({ email: "a@acme.com", password: "correct-password" });
      expect(result.accessToken).toBeDefined();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it("rejects a deactivated user even with the correct password", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 4);
      prisma.user.findFirst.mockResolvedValue({ id: "user-1", isActive: false, passwordHash });
      await expect(service.login({ email: "a@acme.com", password: "correct-password" })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
