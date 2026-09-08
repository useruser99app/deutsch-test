import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate, CandidateDocument, ChangeItem } from "@/lib/domain";

/**
 * Single server-side loader for everything the candidate portal shows.
 * Every read goes through the candidate's own RLS-scoped session — there is
 * no privileged path here, and no second copy of the candidate data logic.
 */

export interface ApprenticeshipDetails {
  desired_training_start: string | null;
  school_qualification: string | null;
  school_specialization: string | null;
  graduation_year: number | null;
  german_certificate_type: string | null;
  german_certificate_status: string | null;
  internship_experience: string | null;
  internship_experience_language: string | null;
  relevant_experience: string | null;
  relevant_experience_language: string | null;
  preferred_locations: string[] | null;
  motivation_summary: string | null;
  motivation_summary_language: string | null;
}

export interface SkilledWorkerDetails {
  profession: string | null;
  years_experience: number | null;
  highest_qualification: string | null;
  specialization: string | null;
  preferred_positions: string[] | null;
  preferred_locations: string[] | null;
}

export interface CandidateProfileRow {
  profile_status: string;
  published_at: string | null;
}

export interface CandidateSnapshot {
  candidate: Candidate;
  isApprenticeship: boolean;
  apprenticeship: ApprenticeshipDetails | null;
  skilled: SkilledWorkerDetails | null;
  occupations: { occupation: string; rank: number }[];
  profile: CandidateProfileRow | null;
}

/**
 * Loads the canonical (approved) state of a candidate.
 *
 * Without `candidateId` this resolves to the signed-in candidate's own row
 * (RLS returns exactly that one). Admins pass a `candidateId` to inspect a
 * specific candidate — same queries, same RLS, no second data path.
 */
export async function loadCandidateSnapshot(
  supabase: SupabaseClient,
  candidateId?: string
): Promise<CandidateSnapshot | null> {
  const candidateQuery = supabase.from("candidates").select("*");
  if (candidateId) candidateQuery.eq("id", candidateId);
  const { data: candidate } = await candidateQuery.maybeSingle<Candidate>();
  if (!candidate) return null;

  const isApprenticeship =
    candidate.candidate_type === "apprenticeship_candidate";

  const [detailsResult, occupationsResult, profileResult] = await Promise.all([
    supabase
      .from(
        isApprenticeship ? "apprenticeship_details" : "skilled_worker_details"
      )
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle(),
    isApprenticeship
      ? supabase
          .from("candidate_target_occupations")
          .select("occupation, rank")
          .eq("candidate_id", candidate.id)
          .order("rank")
      : Promise.resolve({ data: [] as { occupation: string; rank: number }[] }),
    supabase
      .from("candidate_profiles")
      .select("profile_status, published_at")
      .eq("candidate_id", candidate.id)
      .maybeSingle<CandidateProfileRow>(),
  ]);

  return {
    candidate,
    isApprenticeship,
    apprenticeship: isApprenticeship
      ? (detailsResult.data as ApprenticeshipDetails | null)
      : null,
    skilled: isApprenticeship
      ? null
      : (detailsResult.data as SkilledWorkerDetails | null),
    occupations: (occupationsResult.data ?? []) as {
      occupation: string;
      rank: number;
    }[],
    profile: profileResult.data ?? null,
  };
}

/**
 * The approved value of a changeable field, in the same shape the change
 * workflow stores it (string | number | boolean | string[] | null).
 */
export function approvedValue(
  snapshot: CandidateSnapshot,
  key: string
): unknown {
  const { candidate, apprenticeship, skilled, occupations } = snapshot;

  if (key === "target_occupations") {
    return occupations.map((entry) => entry.occupation);
  }

  const core = candidate as unknown as Record<string, unknown>;
  if (key in core) return core[key];

  const details = (apprenticeship ?? skilled) as unknown as
    | Record<string, unknown>
    | null;
  if (details && key in details) return details[key];

  return null;
}

/** Field keys that currently have a pending proposal. */
export function pendingFieldKeys(items: ChangeItem[]): Set<string> {
  return new Set(
    items.filter((item) => item.status === "pending").map((item) => item.field_key)
  );
}

export interface CandidateReviewData {
  pending: ChangeItem[];
  history: ChangeItem[];
}

/**
 * Change items of the signed-in candidate, split into open proposals and
 * decided history. Rejected items are kept — the trail stays complete (§30).
 */
export async function loadChangeItems(
  supabase: SupabaseClient,
  options: { candidateId?: string; limit?: number } = {}
): Promise<CandidateReviewData> {
  let query = supabase.from("candidate_change_items").select("*");
  if (options.candidateId) query = query.eq("candidate_id", options.candidateId);

  const ordered = query.order("created_at", { ascending: false });
  const { data } = await (options.limit ? ordered.limit(options.limit) : ordered);
  const items = (data ?? []) as ChangeItem[];

  return {
    pending: items.filter((item) => item.status === "pending"),
    history: items.filter((item) => item.status !== "pending"),
  };
}

export async function loadDocuments(
  supabase: SupabaseClient,
  candidateId?: string
): Promise<CandidateDocument[]> {
  let query = supabase.from("candidate_documents").select("*");
  if (candidateId) query = query.eq("candidate_id", candidateId);

  const { data } = await query.order("uploaded_at", { ascending: false });
  return (data ?? []) as CandidateDocument[];
}
