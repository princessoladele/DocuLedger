import { DocumentSchemaDefinition } from "../schema-types";
import { realEstateLeaseAgreement } from "./real-estate";
import { healthcareInsuranceClaim } from "./healthcare";
import { financeInvoice } from "./finance";
import { logisticsBillOfLading } from "./logistics";
import { complianceKycIdentity } from "./compliance";

export {
  realEstateLeaseAgreement,
  healthcareInsuranceClaim,
  financeInvoice,
  logisticsBillOfLading,
  complianceKycIdentity,
};

/** Built-in, organization-agnostic templates seeded into every deployment. */
export const BUILT_IN_SCHEMA_TEMPLATES: DocumentSchemaDefinition[] = [
  realEstateLeaseAgreement,
  healthcareInsuranceClaim,
  financeInvoice,
  logisticsBillOfLading,
  complianceKycIdentity,
];
