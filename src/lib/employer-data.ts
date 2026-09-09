import type { SupabaseClient } from "@supabase/supabase-js";
import {
  activeInterestRequestStatuses,
  type CandidateType,
  type GermanLevel,
  type InterestRequestStatus,
} from "@/lib/domain";

/**
 * Employer read queries. Everything runs through the employer's own
 * RLS-scoped session — there is no privileged client here.
 *
 * All candidate data comes from `employer_candidate_profiles`, the view
 * whose column list IS the publication whitelist (migration 0010). Private
 * identity is not merely filtered out in this file: it is never selected,
 * so it cannot reach the client.
 */

/** Exactly the columns the employer-facing view exposes. */
export interface EmployerCandidate {
  profile_id: string;
  candidate_code: string;
  candidate_type: CandidateType;
  published_at: string | null;
  german_level: GermanLevel;
  availability_date: string | null;
  relocation_ready: boolean | null;
  drivers_license: boolean | null;
  country: string | null;
  target_occupations: string[] | null;
  primary_occupation: string | null;
  desired_training_start: string | null;
  school_qualification: string | null;
  school_specialization: string | null;
  graduation_year: number | null;
  german_certificate_type: string | null;
  german_certificate_status: string | null;
  has_practical_experience: boolean | null;
  profession: string | null;
  specialization: string | null;
  years_experience: number | null;
  highest_qualification: string | null;
  preferred_positions: string[] | null;
  preferred_locations: string[] | null;
  skills: string[] | null;
  headline_occupation: string | null;
}

const CANDIDATE_SELECT = `
  profile_id, candidate_code, candidate_type, published_at,
  german_level, availability_date, relocation_ready, drivers_license, country,
  target_occupations, primary_occupation, desired_training_start,
  school_qualification, school_specialization, graduation_year,
  german_certificate_type, german_certificate_status, has_practical_experience,
  profession, specialization, years_experience, highest_qualification,
  preferred_positions, preferred_locations, skills, headline_occupation
`;

export interface MarketplaceFilters {
  candidateType?: CandidateType;
  occupation?: string;
  germanLevel?: string;
  trainingStartFrom?: string;
  schoolQualification?: string;
  practicalExperience?: boolean;
  profession?: string;
  minExperience?: number;
  availableFrom?: string;
  relocationOnly?: boolean;
  location?: string;
}

export interface MarketplaceResult {
  rows: EmployerCandidate[];
  truncated: boolean;
}

const MARKETPLACE_LIMIT = 100;

/**
 * Free-text filters are matched with PostgREST `ilike`. The term is
 * sanitized first: `%` and `_` are wildcards and `,` `(` `)` delimit
 * PostgREST filter syntax, so an unsanitized term could widen the query.
 */
function sanitizeTerm(term: string): string {
  return term.replace(/[%_,()*\\]/g, "").trim().slice(0, 60);
}

/** Published, anonymized candidates matching the employer's filters. */
export async function loadMarketplace(
  supabase: SupabaseClient,
  filters: MarketplaceFilters = {}
): Promise<MarketplaceResult> {
  let query = supabase
    .from("employer_candidate_profiles")
    .select(CANDIDATE_SELECT);

  if (filters.candidateType) {
    query = query.eq("candidate_type", filters.candidateType);
  }
  if (filters.germanLevel) {
    query = query.eq("german_level", filters.germanLevel);
  }
  if (filters.occupation) {
    const term = sanitizeTerm(filters.occupation);
    if (term) query = query.ilike("primary_occupation", `%${term}%`);
  }
  if (filters.profession) {
    const term = sanitizeTerm(filters.profession);
    if (term) query = query.ilike("profession", `%${term}%`);
  }
  if (filters.schoolQualification) {
    const term = sanitizeTerm(filters.schoolQualification);
    if (term) query = query.ilike("school_qualification", `%${term}%`);
  }
  if (filters.trainingStartFrom) {
    query = query.gte("desired_training_start", filters.trainingStartFrom);
  }
  if (filters.availableFrom) {
    query = query.lte("availability_date", filters.availableFrom);
  }
  if (filters.practicalExperience) {
    query = query.eq("has_practical_experience", true);
  }
  if (filters.relocationOnly) {
    query = query.eq("relocation_ready", true);
  }
  if (typeof filters.minExperience === "number") {
    query = query.gte("years_experience", filters.minExperience);
  }
  if (filters.location) {
    const term = sanitizeTerm(filters.location);
    // Postgres array containment: the candidate listed this exact location.
    if (term) query = query.contains("preferred_locations", [term]);
  }

  const { data } = await query
    .order("published_at", { ascending: false })
    .limit(MARKETPLACE_LIMIT + 1);

  const rows = (data ?? []) as EmployerCandidate[];
  return {
    rows: rows.slice(0, MARKETPLACE_LIMIT),
    truncated: rows.length > MARKETPLACE_LIMIT,
  };
}

/** One published candidate, or null when it is not (or no longer) published. */
export async function loadEmployerCandidate(
  supabase: SupabaseClient,
  profileId: string
): Promise<EmployerCandidate | null> {
  const { data } = await supabase
    .from("employer_candidate_profiles")
    .select(CANDIDATE_SELECT)
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as EmployerCandidate | null) ?? null;
}

/**
 * Approved German prose for a published profile (§12). Only `approved`
 * localizations are read: unapproved source-language free text must never
 * be presented as an approved employer profile. Falls back to nothing —
 * never to another language and never to raw candidate input.
 */
export interface PublicNarrative {
  public_title: string | null;
  public_summary: string | null;
  education_summary: string | null;
  experience_summary: string | null;
  motivation_summary: string | null;
}

export async function loadPublicNarrative(
  supabase: SupabaseClient,
  profileId: string,
  locale: string
): Promise<PublicNarrative | null> {
  const { data } = await supabase
    .from("candidate_profile_localizations")
    .select(
      "public_title, public_summary, education_summary, experience_summary, motivation_summary"
    )
    .eq("candidate_profile_id", profileId)
    .eq("locale", locale)
    .eq("translation_status", "approved")
    .maybeSingle();
  return (data as PublicNarrative | null) ?? null;
}

export interface EmployerRequest {
  id: string;
  status: InterestRequestStatus;
  created_at: string;
  message: string | null;
  candidate_profile_id: string;
  jobs: { title: string } | null;
}

/**
 * The company's own introduction requests. RLS scopes this to companies the
 * user belongs to, so another company's requests are unreachable.
 *
 * `review_comment` is deliberately NOT selected: internal admin notes are
 * not employer-visible (§16).
 */
export async function loadEmployerRequests(
  supabase: SupabaseClient
): Promise<EmployerRequest[]> {
  const { data } = await supabase
    .from("interest_requests")
    .select("id, status, created_at, message, candidate_profile_id, jobs(title)")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as EmployerRequest[];
}

/**
 * The company's currently open request for one candidate, if any. Drives
 * the "already requested" state instead of offering a second primary CTA.
 */
export async function loadActiveRequest(
  supabase: SupabaseClient,
  profileId: string
): Promise<{ id: string; status: InterestRequestStatus } | null> {
  const { data } = await supabase
    .from("interest_requests")
    .select("id, status")
    .eq("candidate_profile_id", profileId)
    .in("status", activeInterestRequestStatuses as unknown as string[])
    .maybeSingle();
  return (data as { id: string; status: InterestRequestStatus } | null) ?? null;
}

/** Jobs the employer may optionally attach to a request (§14). */
export async function loadCompanyJobs(
  supabase: SupabaseClient
): Promise<{ id: string; title: string }[]> {
  const { data } = await supabase
    .from("jobs")
    .select("id, title")
    .in("status", ["draft", "open"])
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as { id: string; title: string }[];
}

/** The company the current employer acts for. */
export async function loadOwnCompany(
  supabase: SupabaseClient
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from("companies")
    .select("id, name")
    .limit(1)
    .maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}
