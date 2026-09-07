import { changeableFields, type CandidateType } from "@/lib/domain";

/**
 * Presentation descriptors for the fields a candidate may propose changes
 * for. This is NOT a second data model: every key here must exist in
 * `changeableFields` (which mirrors the database registry in
 * candidate_field_domain / candidate_field_type). The form and the server
 * action both iterate this list, so there is exactly one place that decides
 * which fields the portal offers and how they are parsed.
 */

export type FieldInput =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "boolean"
  | "list"
  | "german_level"
  | "certificate_status";

export type FieldSection =
  | "profile"
  | "occupation"
  | "language"
  | "education"
  | "experience"
  | "availability";

/** Dashboard section order — Ausbildung first, per the primary use case. */
export const fieldSections: FieldSection[] = [
  "profile",
  "occupation",
  "language",
  "education",
  "experience",
  "availability",
];

export interface CandidateFieldDef {
  key: string;
  input: FieldInput;
  section: FieldSection;
  appliesTo: "all" | CandidateType;
  /** Free text keeps the candidate's input language (§24). */
  freeText?: boolean;
}

export const candidateFields: CandidateFieldDef[] = [
  // Profile
  { key: "first_name", input: "text", section: "profile", appliesTo: "all" },
  { key: "last_name", input: "text", section: "profile", appliesTo: "all" },
  { key: "phone", input: "text", section: "profile", appliesTo: "all" },
  { key: "date_of_birth", input: "date", section: "profile", appliesTo: "all" },
  { key: "nationality", input: "text", section: "profile", appliesTo: "all" },
  {
    key: "country_of_residence",
    input: "text",
    section: "profile",
    appliesTo: "all",
  },

  // Occupation / career goal
  {
    key: "target_occupations",
    input: "list",
    section: "occupation",
    appliesTo: "apprenticeship_candidate",
  },
  {
    key: "desired_training_start",
    input: "date",
    section: "occupation",
    appliesTo: "apprenticeship_candidate",
  },
  {
    key: "profession",
    input: "text",
    section: "occupation",
    appliesTo: "skilled_worker",
  },
  {
    key: "specialization",
    input: "text",
    section: "occupation",
    appliesTo: "skilled_worker",
  },
  {
    key: "preferred_positions",
    input: "list",
    section: "occupation",
    appliesTo: "skilled_worker",
  },

  // Language skills
  { key: "german_level", input: "german_level", section: "language", appliesTo: "all" },
  {
    key: "german_certificate_type",
    input: "text",
    section: "language",
    appliesTo: "apprenticeship_candidate",
  },
  {
    key: "german_certificate_status",
    input: "certificate_status",
    section: "language",
    appliesTo: "apprenticeship_candidate",
  },

  // Education / qualification
  {
    key: "school_qualification",
    input: "text",
    section: "education",
    appliesTo: "apprenticeship_candidate",
  },
  {
    key: "school_specialization",
    input: "text",
    section: "education",
    appliesTo: "apprenticeship_candidate",
  },
  {
    key: "graduation_year",
    input: "number",
    section: "education",
    appliesTo: "apprenticeship_candidate",
  },
  {
    key: "highest_qualification",
    input: "text",
    section: "education",
    appliesTo: "skilled_worker",
  },

  // Experience
  {
    key: "internship_experience",
    input: "textarea",
    section: "experience",
    appliesTo: "apprenticeship_candidate",
    freeText: true,
  },
  {
    key: "relevant_experience",
    input: "textarea",
    section: "experience",
    appliesTo: "apprenticeship_candidate",
    freeText: true,
  },
  {
    key: "motivation_summary",
    input: "textarea",
    section: "experience",
    appliesTo: "apprenticeship_candidate",
    freeText: true,
  },
  {
    key: "years_experience",
    input: "number",
    section: "experience",
    appliesTo: "skilled_worker",
  },

  // Availability / mobility
  {
    key: "availability_date",
    input: "date",
    section: "availability",
    appliesTo: "all",
  },
  {
    key: "preferred_locations",
    input: "list",
    section: "availability",
    appliesTo: "all",
  },
  {
    key: "relocation_ready",
    input: "boolean",
    section: "availability",
    appliesTo: "all",
  },
  {
    key: "drivers_license",
    input: "boolean",
    section: "availability",
    appliesTo: "all",
  },
];

/** Fields offered for a candidate type, in declaration order. */
export function fieldsFor(candidateType: CandidateType): CandidateFieldDef[] {
  return candidateFields.filter(
    (field) =>
      (field.appliesTo === "all" || field.appliesTo === candidateType) &&
      field.key in changeableFields
  );
}

export function fieldsForSection(
  candidateType: CandidateType,
  section: FieldSection
): CandidateFieldDef[] {
  return fieldsFor(candidateType).filter((field) => field.section === section);
}

/** Certificate status values stored language-neutrally (§23). */
export const certificateStatuses = [
  "none",
  "planned",
  "registered",
  "obtained",
] as const;
