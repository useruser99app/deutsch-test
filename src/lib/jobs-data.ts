import type { SupabaseClient } from "@supabase/supabase-js";
import type { GermanLevel } from "@/lib/domain";

/**
 * Vacancy reads. Everything runs through the caller's own RLS-scoped
 * session: the existing policies already restrict an employer to their own
 * company and let an admin inspect all jobs, so there is no privileged
 * client and no company filter written in application code.
 */

export const jobTypes = ["apprenticeship", "skilled_position"] as const;
export type JobType = (typeof jobTypes)[number];

export const jobStatuses = ["draft", "open", "closed", "archived"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export interface Job {
  id: string;
  company_id: string;
  job_type: JobType;
  title: string;
  description: string | null;
  profession_or_training_occupation: string | null;
  location: string | null;
  country: string;
  required_german_level: GermanLevel | null;
  minimum_experience_years: number | null;
  training_start_date: string | null;
  employment_type: string | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

const JOB_SELECT = `
  id, company_id, job_type, title, description,
  profession_or_training_occupation, location, country,
  required_german_level, minimum_experience_years, training_start_date,
  employment_type, status, created_at, updated_at
`;

export interface JobFilters {
  status?: JobStatus;
  jobType?: JobType;
}

/** The employer's own vacancies. RLS scopes this to their company. */
export async function loadJobs(
  supabase: SupabaseClient,
  filters: JobFilters = {}
): Promise<Job[]> {
  let query = supabase.from("jobs").select(JOB_SELECT);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.jobType) query = query.eq("job_type", filters.jobType);

  const { data } = await query.order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as Job[];
}

export async function loadJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<Job | null> {
  const { data } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("id", jobId)
    .maybeSingle();
  return (data as Job | null) ?? null;
}

/** Open introduction requests per job, for the list and the detail header. */
export async function loadRequestCountsByJob(
  supabase: SupabaseClient,
  jobIds: string[]
): Promise<Map<string, number>> {
  if (jobIds.length === 0) return new Map();
  const { data } = await supabase
    .from("interest_requests")
    .select("job_id")
    .in("job_id", jobIds);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { job_id: string | null }[]) {
    if (!row.job_id) continue;
    counts.set(row.job_id, (counts.get(row.job_id) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Admin oversight (§9)
// ---------------------------------------------------------------------------

export interface AdminJobRow extends Job {
  companies: { name: string; city: string | null } | null;
}

export async function loadAllJobs(
  supabase: SupabaseClient,
  filters: JobFilters = {}
): Promise<AdminJobRow[]> {
  let query = supabase
    .from("jobs")
    .select(`${JOB_SELECT}, companies(name, city)`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.jobType) query = query.eq("job_type", filters.jobType);

  const { data } = await query.order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as unknown as AdminJobRow[];
}
