/**
 * Language-neutral canonical domain values (see ALLEMARO principle §23).
 * These keys are stored in the database as-is; human-readable labels are
 * resolved at presentation level via the i18n message catalogs.
 */

export const appRoles = ["admin", "candidate", "employer"] as const;
export type AppRole = (typeof appRoles)[number];

export const accountStatuses = [
  "invited",
  "active",
  "suspended",
  "pending_verification",
] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export const candidateTypes = [
  "apprenticeship_candidate",
  "skilled_worker",
] as const;
export type CandidateType = (typeof candidateTypes)[number];

export const germanLevels = [
  "none",
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "native",
] as const;
export type GermanLevel = (typeof germanLevels)[number];

export const reviewStatuses = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const documentTypes = [
  "cv",
  "school_certificate",
  "diploma",
  "work_certificate",
  "internship_certificate",
  "language_certificate",
  "passport",
  "other",
] as const;
export type DocumentType = (typeof documentTypes)[number];

export const documentStatuses = [
  "pending_review",
  "approved",
  "rejected",
  "superseded",
] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

export const profileStatuses = ["draft", "published", "unpublished"] as const;
export type ProfileStatus = (typeof profileStatuses)[number];

/**
 * Introduction request lifecycle (§16/§17). ALLEMARO facilitates the actual
 * introduction operationally; 'introduced' records that this happened. No
 * status change ever releases candidate contact data to the employer (§18).
 */
export const interestRequestStatuses = [
  "new",
  "reviewing",
  "approved",
  "rejected",
  "introduced",
] as const;
export type InterestRequestStatus = (typeof interestRequestStatuses)[number];

/** Statuses that count as an open request for duplicate protection (§15). */
export const activeInterestRequestStatuses: readonly InterestRequestStatus[] = [
  "new",
  "reviewing",
  "approved",
];

export const localeCodes = ["de", "en", "fr", "ar"] as const;
export type LocaleCode = (typeof localeCodes)[number];

export const fieldTypes = [
  "string",
  "number",
  "date",
  "boolean",
  "array",
  "json",
] as const;
export type FieldType = (typeof fieldTypes)[number];

/**
 * Field keys candidates may propose changes for in V0.1.
 * Must stay in sync with `candidate_field_current_value` /
 * `apply_candidate_field` in the database (migration 0007).
 */
export const changeableFields: Record<string, FieldType> = {
  first_name: "string",
  last_name: "string",
  phone: "string",
  date_of_birth: "date",
  nationality: "string",
  country_of_residence: "string",
  german_level: "string",
  availability_date: "date",
  drivers_license: "boolean",
  relocation_ready: "boolean",
  target_occupations: "array",
  desired_training_start: "date",
  school_qualification: "string",
  school_specialization: "string",
  graduation_year: "number",
  german_certificate_type: "string",
  german_certificate_status: "string",
  internship_experience: "string",
  relevant_experience: "string",
  preferred_locations: "array",
  motivation_summary: "string",
  profession: "string",
  years_experience: "number",
  highest_qualification: "string",
  specialization: "string",
  preferred_positions: "array",
};

/**
 * Result state for admin account-creation forms (useActionState).
 * The one-time invite link is returned ONLY in the POST response body —
 * never through URL query parameters (no browser history, access logs,
 * analytics or copied URLs).
 */
export interface InviteActionState {
  status: "idle" | "success" | "error";
  candidateCode?: string;
  inviteLink?: string | null;
}

/** Result state for the employer's "request introduction" form. */
export interface IntroductionActionState {
  status: "idle" | "success" | "error" | "duplicate";
  requestStatus?: InterestRequestStatus;
}

/** Result state for the admin publish / unpublish control. */
export interface PublishActionState {
  status: "idle" | "success" | "error";
  profileStatus?: ProfileStatus;
  /** Canonical reason code when publication prerequisites are unmet (§5). */
  reason?: string;
}

export interface AppUser {
  id: string;
  email: string;
  role: AppRole;
  account_status: AccountStatus;
  preferred_locale: LocaleCode;
}

export interface Candidate {
  id: string;
  user_id: string | null;
  candidate_code: string;
  candidate_type: CandidateType;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  country_of_residence: string | null;
  german_level: GermanLevel;
  availability_date: string | null;
  drivers_license: boolean | null;
  relocation_ready: boolean | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeItem {
  id: string;
  change_set_id: string;
  candidate_id: string;
  field_key: string;
  field_type: FieldType;
  current_value: unknown;
  proposed_value: unknown;
  source_language: LocaleCode | null;
  status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_type: DocumentType;
  file_path: string;
  original_filename: string;
  mime_type: string;
  verification_status: DocumentStatus;
  replaces_document_id: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
}

/** Renders a stored JSONB value for display without locale assumptions. */
export function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
