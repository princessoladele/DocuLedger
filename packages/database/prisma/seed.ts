import { PrismaClient } from "@prisma/client";
import { BUILT_IN_SCHEMA_TEMPLATES } from "@doculedger/shared";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${BUILT_IN_SCHEMA_TEMPLATES.length} built-in schema templates...`);

  for (const template of BUILT_IN_SCHEMA_TEMPLATES) {
    // organizationId is null for built-ins, and Postgres does not enforce
    // uniqueness across NULLs in a composite unique index, so we look these
    // up explicitly rather than relying on upsert()'s unique-key matching.
    const existing = await prisma.documentSchema.findFirst({
      where: { organizationId: null, key: template.key, version: template.version },
    });

    if (existing) {
      await prisma.documentSchema.update({
        where: { id: existing.id },
        data: {
          name: template.name,
          description: template.description,
          fields: template.fields as any,
          confidenceThreshold: template.confidenceThreshold,
          isActive: true,
        },
      });
    } else {
      await prisma.documentSchema.create({
        data: {
          organizationId: null,
          key: template.key,
          name: template.name,
          industry: template.industry,
          description: template.description,
          version: template.version,
          confidenceThreshold: template.confidenceThreshold,
          fields: template.fields as any,
        },
      });
    }
    console.log(`  ✓ ${template.key}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
