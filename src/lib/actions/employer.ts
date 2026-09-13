"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { loadActiveRequest, loadOwnCompany } from "@/lib/employer-data";
import type { IntroductionActionState } from "@/lib/domain";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * "Vorstellung anfragen" (§13). This creates an interest request against the
 * ANONYMIZED profile and reveals nothing about the candidate: no contact
 * data is read here, returned here, or unlocked by the request existing.
 *
 * Duplicate protection (§15) is layered. The UI hides the CTA when an open
 * request exists, this action re-checks before inserting, and a partial
 * unique index in the database is the final authority — so two tabs, a
 * double click or two colleagues of the same company cannot race past it.
 */
export async function requestIntroductionAction(
  _prev: IntroductionActionState,
  formData: FormData
): Promise<IntroductionActionState> {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "employer");

  const profileId = text(formData, "profile_id");
  const jobId = text(formData, "job_id");
  const message = text(formData, "message").slice(0, 2000) || null;
  if (!profileId) return { status: "error" };

  const existing = await loadActiveRequest(supabase, profileId);
  if (existing) {
    return { status: "duplicate", requestStatus: existing.status };
  }

  const company = await loadOwnCompany(supabase);
  if (!company) return { status: "error" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };

  const { error } = await supabase.from("interest_requests").insert({
    company_id: company.id,
    candidate_profile_id: profileId,
    job_id: jobId || null,
    requested_by: user.id,
    message,
  });

  if (error) {
    // 23505 = the duplicate-protection index caught a concurrent request.
    if (error.code === "23505") {
      const current = await loadActiveRequest(supabase, profileId);
      return { status: "duplicate", requestStatus: current?.status ?? "new" };
    }
    return { status: "error" };
  }

  revalidatePath(`/${locale}/employer/candidates/${profileId}`);
  revalidatePath(`/${locale}/employer/requests`);
  return { status: "success", requestStatus: "new" };
}

/**
 * Marks the notification events of one request as read (§6).
 *
 * Explicit and user-initiated: nothing is marked read merely because the
 * employer logged in or a page rendered. RLS scopes the write to the
 * employer's own company, and a column grant limits it to read_at/read_by,
 * so no other field can be touched from a browser session.
 */
export async function markRequestReadAction(formData: FormData) {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "employer");

  const requestId = text(formData, "request_id");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("employer_notifications")
    .update({ read_at: new Date().toISOString(), read_by: user?.id ?? null })
    .is("read_at", null);

  // Without a request id this is the explicit "mark all as read" action.
  if (requestId) query = query.eq("interest_request_id", requestId);

  await query;

  revalidatePath(`/${locale}/employer/requests`);
  revalidatePath(`/${locale}/employer`);
}

/** Result state for the vacancy form. */
export interface JobActionState {
  status: "idle" | "success" | "error";
  jobId?: string;
}

function optionalText(formData: FormData, key: string): string | null {
  return String(formData.get(key) ?? "").trim() || null;
}

/**
 * Create or update a vacancy (§6, §7).
 *
 * The company is resolved SERVER-SIDE from the caller's own membership and
 * is never read from the form, so an employer cannot file a vacancy under
 * another company even by editing the request. The RLS insert/update policy
 * on `jobs` is the second, authoritative check.
 */
export async function saveJobAction(
  _prev: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "employer");

  const jobId = text(formData, "job_id");
  const title = text(formData, "title");
  const jobType =
    text(formData, "job_type") === "skilled_position"
      ? "skilled_position"
      : "apprenticeship";
  const status = (["draft", "open", "closed"] as const).includes(
    text(formData, "status") as "draft"
  )
    ? (text(formData, "status") as "draft" | "open" | "closed")
    : "draft";

  if (!title) return { status: "error" };

  const rawGerman = text(formData, "required_german_level");
  const rawExperience = text(formData, "minimum_experience_years");
  const experience = rawExperience === "" ? null : Number(rawExperience);

  const payload = {
    job_type: jobType,
    title,
    description: optionalText(formData, "description"),
    profession_or_training_occupation: optionalText(formData, "occupation"),
    location: optionalText(formData, "location"),
    country: text(formData, "country") || "DE",
    required_german_level: rawGerman || null,
    // An apprenticeship never stores a minimum years-of-experience
    // requirement: it is not a meaningful demand on a school leaver.
    minimum_experience_years:
      jobType === "skilled_position" && experience !== null && !Number.isNaN(experience)
        ? experience
        : null,
    training_start_date: optionalText(formData, "training_start_date"),
    employment_type:
      jobType === "skilled_position"
        ? optionalText(formData, "employment_type")
        : null,
    status,
  };

  if (jobId) {
    const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
    if (error) return { status: "error", jobId };
    revalidatePath(`/${locale}/employer/jobs`);
    revalidatePath(`/${locale}/employer/jobs/${jobId}`);
    return { status: "success", jobId };
  }

  const company = await loadOwnCompany(supabase);
  if (!company) return { status: "error" };

  const { data, error } = await supabase
    .from("jobs")
    .insert({ ...payload, company_id: company.id })
    .select("id")
    .single();
  if (error || !data) return { status: "error" };

  revalidatePath(`/${locale}/employer/jobs`);
  redirect(`/${locale}/employer/jobs/${(data as { id: string }).id}`);
}
