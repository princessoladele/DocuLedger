import { DocumentSchemaDefinition } from "../schema-types";

export const healthcareInsuranceClaim: DocumentSchemaDefinition = {
  key: "healthcare.insurance-claim",
  name: "Health Insurance Claim Form (CMS-1500 style)",
  industry: "HEALTHCARE",
  description:
    "Extracts patient, provider and billing fields from a health insurance claim form.",
  version: 1,
  confidenceThreshold: 0.9,
  fields: [
    {
      name: "patient_name",
      label: "Patient Name",
      type: "string",
      required: true,
      aliases: ["Patient Name", "Patient's Name", "Name of Patient"],
    },
    {
      name: "patient_dob",
      label: "Patient Date of Birth",
      type: "date",
      required: true,
      aliases: ["Date of Birth", "DOB", "Patient DOB"],
    },
    {
      name: "member_id",
      label: "Insurance Member ID",
      type: "string",
      required: true,
      aliases: ["Member ID", "Insured ID", "Policy Number", "Subscriber ID"],
      pattern: "^[A-Za-z0-9-]{5,20}$",
    },
    {
      name: "provider_name",
      label: "Provider / Physician Name",
      type: "string",
      required: true,
      aliases: ["Provider Name", "Physician", "Rendering Provider"],
    },
    {
      name: "provider_npi",
      label: "Provider NPI",
      type: "string",
      required: false,
      aliases: ["NPI", "National Provider Identifier"],
      pattern: "^[0-9]{10}$",
    },
    {
      name: "diagnosis_code",
      label: "Diagnosis Code (ICD-10)",
      type: "string",
      required: true,
      aliases: ["Diagnosis Code", "ICD-10", "Dx Code"],
      pattern: "^[A-TV-Z][0-9][0-9AB](\\.[0-9A-TV-Z]{1,4})?$",
    },
    {
      name: "service_date",
      label: "Date of Service",
      type: "date",
      required: true,
      aliases: ["Date of Service", "Service Date", "DOS"],
    },
    {
      name: "billed_amount",
      label: "Total Charges",
      type: "currency",
      required: true,
      aliases: ["Total Charges", "Amount Billed", "Charges"],
      pattern: "^\\$?[0-9][0-9,]*(\\.[0-9]{2})?$",
    },
  ],
};
