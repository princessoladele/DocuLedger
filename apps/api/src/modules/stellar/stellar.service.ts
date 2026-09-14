import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AnchorService, createAnchorServiceFromEnv } from "@doculedger/stellar";
import { fingerprintOf } from "@doculedger/shared";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuthPrincipal } from "../../common/decorators/current-user.decorator";

@Injectable()
export class StellarService {
  private readonly anchorService: AnchorService;

  constructor(private readonly prisma: PrismaService) {
    this.anchorService = createAnchorServiceFromEnv();
  }

  /**
   * Recomputes a document's current fingerprint from its latest extraction
   * and compares it against (a) what DocuLedger recorded at anchoring time
   * and (b) what the chain actually holds — a mismatch on either side means
   * either our DB row or the on-chain record no longer matches the data,
   * which is exactly the tamper-evidence this feature exists to provide.
   */
  async verifyDocument(principal: AuthPrincipal, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId: principal.organizationId },
      include: {
        extractions: { orderBy: { createdAt: "desc" }, take: 1 },
        anchorRecords: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!document) throw new NotFoundException("Document not found");
    if (!document.anchorRecords.length) {
      throw new BadRequestException("Document has not been anchored yet");
    }
    const anchorRecord = document.anchorRecords[0];
    const extraction = document.extractions[0];
    if (!extraction) throw new BadRequestException("Document has no extraction to verify against");

    const currentFingerprint = fingerprintOf({ documentId: document.id, fields: extraction.fields });
    const matchesStoredRecord = currentFingerprint === anchorRecord.fingerprint;

    const onChain = await this.anchorService.verify(anchorRecord.fingerprint);

    return {
      documentId: document.id,
      currentFingerprint,
      anchoredFingerprint: anchorRecord.fingerprint,
      matchesStoredRecord,
      onChain: onChain
        ? { found: true, orgId: onChain.orgId, submittedAtUnix: onChain.submittedAtUnix }
        : { found: false },
      stellarTxHash: anchorRecord.stellarTxHash,
      network: anchorRecord.network,
      status: anchorRecord.status,
      verified: matchesStoredRecord && Boolean(onChain),
    };
  }
}
