import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { AuthPrincipal } from "../../common/decorators/current-user.decorator";

function makeDoc(overrides: Partial<any> = {}) {
  return {
    id: "doc-1",
    organizationId: "org-1",
    uploadedById: "user-owner",
    storageKey: "org-1/doc-1/file.pdf",
    ...overrides,
  };
}

describe("DocumentsService.get — ownership scoping", () => {
  let prisma: any;
  let service: DocumentsService;

  beforeEach(() => {
    prisma = {
      document: { findFirst: jest.fn() },
    };
    service = new DocumentsService(prisma, {} as any, {} as any, {} as any);
  });

  it("a MEMBER user who did not upload the document is forbidden", async () => {
    prisma.document.findFirst.mockResolvedValue(makeDoc());
    const principal: AuthPrincipal = {
      id: "user-someone-else",
      organizationId: "org-1",
      role: "MEMBER",
      authType: "user",
    };
    await expect(service.get(principal, "doc-1")).rejects.toThrow(ForbiddenException);
  });

  it("a MEMBER user who uploaded the document can read it", async () => {
    prisma.document.findFirst.mockResolvedValue(makeDoc({ uploadedById: "user-owner" }));
    const principal: AuthPrincipal = {
      id: "user-owner",
      organizationId: "org-1",
      role: "MEMBER",
      authType: "user",
    };
    await expect(service.get(principal, "doc-1")).resolves.toMatchObject({ id: "doc-1" });
  });

  it("a REVIEWER (document:read:all) can read any org document regardless of uploader", async () => {
    prisma.document.findFirst.mockResolvedValue(makeDoc({ uploadedById: "someone-else" }));
    const principal: AuthPrincipal = {
      id: "user-reviewer",
      organizationId: "org-1",
      role: "REVIEWER",
      authType: "user",
    };
    await expect(service.get(principal, "doc-1")).resolves.toMatchObject({ id: "doc-1" });
  });

  it("an API key principal is never ownership-restricted, even with MEMBER role", async () => {
    // API-key uploads are attributed to the org's owner user for the FK
    // (see systemUploaderId), so the key's own principal.id never matches
    // uploadedById — the ownership check must not apply to API keys.
    prisma.document.findFirst.mockResolvedValue(makeDoc({ uploadedById: "org-owner-user-id" }));
    const principal: AuthPrincipal = {
      id: "api-key-id",
      organizationId: "org-1",
      role: "MEMBER",
      authType: "api_key",
    };
    await expect(service.get(principal, "doc-1")).resolves.toMatchObject({ id: "doc-1" });
  });

  it("throws NotFoundException for a document outside the caller's organization", async () => {
    prisma.document.findFirst.mockResolvedValue(null);
    const principal: AuthPrincipal = {
      id: "user-1",
      organizationId: "org-1",
      role: "OWNER",
      authType: "user",
    };
    await expect(service.get(principal, "doc-1")).rejects.toThrow(NotFoundException);
  });
});
