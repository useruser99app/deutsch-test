import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateDocument, ChangeItem } from "@/lib/domain";

/**
 * Admin read queries. Everything runs through the admin's own RLS-scoped
 * session — the admin policies already grant these reads, so there is no
 * privileged client and no second approval path here.
 */

export interface CandidateListRow {
  id: string;
  candidate_code: string;
  candidate_type: string;
  first_name: string;
  last_name: string;
  email: string;
  german_level: string;
  availability_date: string | null;
  status: string;
  app_users: { account_status: string } | null;
  candidate_profiles: { profile_status: string } | null;
}

export interface CandidateFilters {
  q?: string;
  candidateType?: string;
  germanLevel?: string;
  profileStatus?: string;
  accountStatus?: string;
  pendingOnly?: boolean;
}

/**
 * PostgREST's `or=` filter is comma/paren delimited, so a raw search term
 * could otherwise change the filter's meaning. Keep only characters that are
 * meaningful for names, codes and e-mail addresses.
 */
function sanitizeSearch(term: string): string {
  return term.replace(/[^\p{L}\p{N}\s@._-]/gu, "").trim().slice(0, 80);
}

export interface CandidateListResult {
  rows: CandidateListRow[];
  pendingChanges: Map<string, number>;
  pendingDocuments: Map<string, number>;
  truncated: boolean;
}

const CANDIDATE_LIST_LIMIT = 200;

/**
 * Candidate list with server-side search and filtering. Pending counts are
 * derived from the pending rows themselves (small working set) rather than
 * from a database view — adding one would require a migration, which this
 * milestone must not do.
 */
export async function loadCandidateList(
  supabase: SupabaseClient,
  filters: CandidateFilters = {}
): Promise<CandidateListResult> {
  // An inner join would drop candidates without the related row, so it is
  // only used when that relation is actually filtered on.
  const profileJoin = filters.profileStatus
    ? "candidate_profiles!inner(profile_status)"
    : "candidate_profiles(profile_status)";
  const accountJoin = filters.accountStatus
    ? "app_users!inner(account_status)"
    : "app_users(account_status)";

  let query = supabase.from("candidates").select(
    `id, candidate_code, candidate_type, first_name, last_name, email,
       german_level, availability_date, status, ${accountJoin}, ${profileJoin}`
  );

  if (filters.candidateType) {
    query = query.eq("candidate_type", filters.candidateType);
  }
  if (filters.germanLevel) {
    query = query.eq("german_level", filters.germanLevel);
  }
  if (filters.profileStatus) {
    query = query.eq("candidate_profiles.profile_status", filters.profileStatus);
  }
  if (filters.accountStatus) {
    query = query.eq("app_users.account_status", filters.accountStatus);
  }

  const search = filters.q ? sanitizeSearch(filters.q) : "";
  if (search.length > 0) {
    query = query.or(
      [
        `candidate_code.ilike.%${search}%`,
        `first_name.ilike.%${search}%`,
        `last_name.ilike.%${search}%`,
        `email.ilike.%${search}%`,
      ].join(",")
    );
  }

  const [listResult, changeResult, documentResult] = await Promise.all([
    query.order("candidate_code").limit(CANDIDATE_LIST_LIMIT),
    supabase
      .from("candidate_change_items")
      .select("candidate_id")
      .eq("status", "pending"),
    supabase
      .from("candidate_documents")
      .select("candidate_id")
      .eq("verification_status", "pending_review"),
  ]);

  const pendingChanges = countBy(changeResult.data);
  const pendingDocuments = countBy(documentResult.data);

  let rows = (listResult.data ?? []) as unknown as CandidateListRow[];
  if (filters.pendingOnly) {
    rows = rows.filter(
      (row) =>
        (pendingChanges.get(row.id) ?? 0) > 0 ||
        (pendingDocuments.get(row.id) ?? 0) > 0
    );
  }

  return {
    rows,
    pendingChanges,
    pendingDocuments,
    truncated: (listResult.data ?? []).length === CANDIDATE_LIST_LIMIT,
  };
}

function countBy(
  rows: { candidate_id: string }[] | null
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    counts.set(row.candidate_id, (counts.get(row.candidate_id) ?? 0) + 1);
  }
  return counts;
}

export interface CandidateRef {
  candidate_code: string;
  first_name: string;
  last_name: string;
  candidate_type: string;
}

export interface ChangeItemWithCandidate extends ChangeItem {
  candidates: CandidateRef | null;
  candidate_change_sets: { submitted_at: string; source: string } | null;
}

export interface DocumentWithCandidate extends CandidateDocument {
  candidates: CandidateRef | null;
}

const CHANGE_SELECT = `*, candidates ( candidate_code, first_name, last_name, candidate_type ),
   candidate_change_sets ( submitted_at, source )`;

const DOCUMENT_SELECT = `*, candidates ( candidate_code, first_name, last_name, candidate_type )`;

/** Open change proposals across all candidates, oldest first (queue order). */
export async function loadPendingChanges(
  supabase: SupabaseClient
): Promise<ChangeItemWithCandidate[]> {
  const { data } = await supabase
    .from("candidate_change_items")
    .select(CHANGE_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as ChangeItemWithCandidate[];
}

/** Decided change items across all candidates, most recent decision first. */
export async function loadDecidedChanges(
  supabase: SupabaseClient,
  limit = 50
): Promise<ChangeItemWithCandidate[]> {
  const { data } = await supabase
    .from("candidate_change_items")
    .select(CHANGE_SELECT)
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as unknown as ChangeItemWithCandidate[];
}

export async function loadPendingDocuments(
  supabase: SupabaseClient
): Promise<DocumentWithCandidate[]> {
  const { data } = await supabase
    .from("candidate_documents")
    .select(DOCUMENT_SELECT)
    .eq("verification_status", "pending_review")
    .order("uploaded_at", { ascending: true });
  return (data ?? []) as unknown as DocumentWithCandidate[];
}

export async function loadDecidedDocuments(
  supabase: SupabaseClient,
  limit = 50
): Promise<DocumentWithCandidate[]> {
  const { data } = await supabase
    .from("candidate_documents")
    .select(DOCUMENT_SELECT)
    .neq("verification_status", "pending_review")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as unknown as DocumentWithCandidate[];
}

export interface AdminOverview {
  pendingChanges: number;
  pendingDocuments: number;
  newRequests: number;
  candidates: number;
  companies: number;
  candidatesByType: Record<string, number>;
  recentChanges: ChangeItemWithCandidate[];
  recentDocuments: DocumentWithCandidate[];
}

/** Counts and recent activity for the admin entry page. */
export async function loadAdminOverview(
  supabase: SupabaseClient
): Promise<AdminOverview> {
  const [
    changes,
    documents,
    candidates,
    companies,
    newRequests,
    apprenticeships,
    skilled,
    recentChanges,
    recentDocuments,
  ] = await Promise.all([
    supabase
      .from("candidate_change_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("candidate_documents")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending_review"),
    supabase.from("candidates").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase
      .from("interest_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("candidate_type", "apprenticeship_candidate"),
    supabase
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("candidate_type", "skilled_worker"),
    supabase
      .from("candidate_change_items")
      .select(CHANGE_SELECT)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("candidate_documents")
      .select(DOCUMENT_SELECT)
      .order("uploaded_at", { ascending: false })
      .limit(5),
  ]);

  return {
    pendingChanges: changes.count ?? 0,
    pendingDocuments: documents.count ?? 0,
    newRequests: newRequests.count ?? 0,
    candidates: candidates.count ?? 0,
    companies: companies.count ?? 0,
    candidatesByType: {
      apprenticeship_candidate: apprenticeships.count ?? 0,
      skilled_worker: skilled.count ?? 0,
    },
    recentChanges: (recentChanges.data ?? []) as unknown as ChangeItemWithCandidate[],
    recentDocuments: (recentDocuments.data ?? []) as unknown as DocumentWithCandidate[],
  };
}

// ---------------------------------------------------------------------------
// Introduction requests (§17)
// ---------------------------------------------------------------------------

export interface InterestRequestRow {
  id: string;
  status: string;
  message: string | null;
  review_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
  candidate_profile_id: string;
  companies: { name: string; city: string | null } | null;
  requester: { email: string } | null;
  jobs: { title: string } | null;
  candidate_profiles: {
    candidate_id: string;
    profile_status: string;
    candidates: {
      candidate_code: string;
      candidate_type: string;
      german_level: string;
      candidate_target_occupations: { occupation: string; rank: number }[];
      skilled_worker_details: { profession: string | null } | null;
    } | null;
  } | null;
}

/**
 * The admin queue. Two foreign keys point at app_users, so the requesting
 * user is selected through an explicit constraint hint.
 *
 * The professional target is read from the canonical model rather than from
 * the employer view, so the queue stays readable after a profile has been
 * unpublished — the request record must survive publication changes (§I).
 */
const REQUEST_SELECT = `
  id, status, message, review_comment, created_at, reviewed_at,
  candidate_profile_id,
  companies(name, city),
  requester:app_users!interest_requests_requested_by_fkey(email),
  jobs(title),
  candidate_profiles(
    candidate_id, profile_status,
    candidates(
      candidate_code, candidate_type, german_level,
      candidate_target_occupations(occupation, rank),
      skilled_worker_details(profession)
    )
  )
`;

export async function loadInterestRequests(
  supabase: SupabaseClient,
  filters: { status?: string } = {}
): Promise<InterestRequestRow[]> {
  let query = supabase.from("interest_requests").select(REQUEST_SELECT);
  if (filters.status) query = query.eq("status", filters.status);

  const { data } = await query.order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as unknown as InterestRequestRow[];
}

/** The one professional fact that identifies what was requested. */
export function requestOccupation(row: InterestRequestRow): string | null {
  const candidate = row.candidate_profiles?.candidates;
  if (!candidate) return null;
  if (candidate.candidate_type === "apprenticeship_candidate") {
    const ranked = [...candidate.candidate_target_occupations].sort(
      (a, b) => a.rank - b.rank
    );
    return ranked[0]?.occupation ?? null;
  }
  return candidate.skilled_worker_details?.profession ?? null;
}

/** Count of requests still waiting for a first admin decision. */
export async function countNewInterestRequests(
  supabase: SupabaseClient
): Promise<number> {
  const { count } = await supabase
    .from("interest_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  return count ?? 0;
}
