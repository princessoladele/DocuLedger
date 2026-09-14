import { DocumentSchemaDefinition } from "../schema-types";

export const complianceKycIdentity: DocumentSchemaDefinition = {
  key: "compliance.kyc-identity-verification",
  name: "KYC Identity Verification Document",
  industry: "COMPLIANCE",
  description:
    "Extracts identity fields from a government ID or KYC intake form for compliance/AML review.",
  version: 1,
  confidenceThreshold: 0.92,
  fields: [
    {
      name: "full_legal_name",
      label: "Full Legal Name",
      type: "string",
      required: true,
      aliases: ["Full Name", "Legal Name", "Name"],
    },
    {
      name: "date_of_birth",
      label: "Date of Birth",
      type: "date",
      required: true,
      aliases: ["Date of Birth", "DOB", "Born"],
    },
    {
      name: "document_number",
      label: "ID / Passport Number",
      type: "string",
      required: true,
      aliases: ["Document Number", "Passport No.", "ID Number", "License Number"],
      pattern: "^[A-Za-z0-9]{5,20}$",
    },
    {
      name: "issuing_country",
      label: "Issuing Country",
      type: "string",
      required: true,
      aliases: ["Issuing Country", "Country of Issue", "Nationality"],
    },
    {
      name: "issue_date",
      label: "Issue Date",
      type: "date",
      required: false,
      aliases: ["Issue Date", "Date of Issue"],
    },
    {
      name: "expiry_date",
      label: "Expiry Date",
      type: "date",
      required: true,
      aliases: ["Expiry Date", "Expiration Date", "Valid Until"],
    },
    {
      name: "residential_address",
      label: "Residential Address",
      type: "address",
      required: true,
      aliases: ["Address", "Residential Address", "Home Address"],
    },
  ],
};
