"use server";

import { revalidatePath } from "next/cache";
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
