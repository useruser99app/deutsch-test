"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  candidateTypes,
  interestRequestStatuses,
  localeCodes,
  type InterestRequestStatus,
  type InviteActionState,
  type ProfileStatus,
  type PublishActionState,
} from "@/lib/domain";
import { provisionAccount, ProvisioningError } from "@/lib/provisioning";
import { dispatchNotificationEmails } from "@/lib/email/notify";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function pick<T extends readonly string[]>(
  values: T,
  raw: string,
  fallback: T[number]
): T[number] {
  return (values as readonly string[]).includes(raw)
    ? (raw as T[number])
    : fallback;
}

/**
 * Admin-created candidate accounts (§3A): no public signup. The account is
 * provisioned via Supabase invite (magic link) and starts as
 * account_status = 'invited'; the candidate activates it by setting a
 * password at /set-password. For environments without SMTP the admin can
 * generate the invite link directly instead of sending an email.
 *
 * useActionState action: the generated invite link is returned only in the
 * POST response (one-time display) and never appears in a URL.
 */
export async function createCandidateAccountAction(
  _prev: InviteActionState,
  formData: FormData
): Promise<InviteActionState> {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "admin");

  const email = text(formData, "email").toLowerCase();
  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");
  const candidateType = pick(
    candidateTypes,
    text(formData, "candidate_type"),
    "apprenticeship_candidate"
  );
  const preferredLocale = pick(localeCodes, text(formData, "preferred_locale"), "fr");
  const inviteMode = text(formData, "invite_mode") === "link" ? "link" : "email";

  if (!email || !firstName || !lastName) {
    return { status: "error" };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo = `${site}/auth/callback?next=/${preferredLocale}/set-password`;
  const metadata = {
    norav_role: "candidate",
    norav_account_status: "invited",
    norav_locale: preferredLocale,
  };

  const admin = createAdminClient();
  let userId: string;
  let inviteLink: string | null = null;

  if (inviteMode === "link") {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: metadata, redirectTo },
    });
    if (error || !data.user) {
      return { status: "error" };
    }
    userId = data.user.id;
    inviteLink = data.properties?.action_link ?? null;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: metadata,
      redirectTo,
    });
    if (error || !data.user) {
      return { status: "error" };
    }
    userId = data.user.id;
  }

  // The invite only creates the auth user; handle_new_user() gives it safe
  // defaults (candidate / invited). State the intended account state
  // explicitly with the service role and verify it — never rely on the
  // trigger reading the invite metadata.
  try {
    await provisionAccount(admin, {
      userId,
      email,
      role: "candidate",
      accountStatus: "invited",
      locale: preferredLocale,
    });
  } catch (error) {
    console.error(
      "Candidate account provisioning failed",
      error instanceof ProvisioningError ? error.message : error
    );
    return { status: "error" };
  }

  // Canonical candidate row + empty type-specific detail row + draft
  // publication profile. Inserted with the ADMIN'S OWN session (RLS-checked).
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .insert({
      user_id: userId,
      candidate_type: candidateType,
      first_name: firstName,
      last_name: lastName,
      email,
    })
    .select("id, candidate_code")
    .single();
  if (candidateError || !candidate) {
    return { status: "error" };
  }

  if (candidateType === "apprenticeship_candidate") {
    await supabase
      .from("apprenticeship_details")
      .insert({ candidate_id: candidate.id });
  } else {
    await supabase
      .from("skilled_worker_details")
      .insert({ candidate_id: candidate.id });
  }
  await supabase.from("candidate_profiles").insert({
    candidate_id: candidate.id,
    candidate_type: candidateType,
  });

  revalidatePath(`/${locale}/admin/candidates`);
  return {
    status: "success",
    candidateCode: candidate.candidate_code,
    inviteLink,
  };
}

export async function createCompany(formData: FormData) {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "admin");

  const name = text(formData, "name");
  if (!name) redirect(`/${locale}/admin/companies?error=failed`);

  const { error } = await supabase.from("companies").insert({
    name,
    website: text(formData, "website") || null,
    industry: text(formData, "industry") || null,
    country: text(formData, "country") || "DE",
    city: text(formData, "city") || null,
  });
  if (error) redirect(`/${locale}/admin/companies?error=failed`);
  redirect(`/${locale}/admin/companies?created=1`);
}

/**
 * Admin-created employer accounts assigned to a company (§3A/§14).
 * useActionState action — invite link only in the POST response, never in
 * a URL.
 */
export async function createEmployerAccountAction(
  _prev: InviteActionState,
  formData: FormData
): Promise<InviteActionState> {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "admin");

  const email = text(formData, "email").toLowerCase();
  const companyId = text(formData, "company_id");
  const preferredLocale = pick(localeCodes, text(formData, "preferred_locale"), "de");
  const inviteMode = text(formData, "invite_mode") === "link" ? "link" : "email";

  if (!email || !companyId) {
    return { status: "error" };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo = `${site}/auth/callback?next=/${preferredLocale}/set-password`;
  const metadata = {
    norav_role: "employer",
    norav_account_status: "invited",
    norav_locale: preferredLocale,
  };

  const admin = createAdminClient();
  let userId: string;
  let inviteLink: string | null = null;

  if (inviteMode === "link") {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: metadata, redirectTo },
    });
    if (error || !data.user) {
      return { status: "error" };
    }
    userId = data.user.id;
    inviteLink = data.properties?.action_link ?? null;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: metadata,
      redirectTo,
    });
    if (error || !data.user) {
      return { status: "error" };
    }
    userId = data.user.id;
  }

  // Same as above: the employer role must be written explicitly, otherwise
  // the trigger's safe default would leave this account as 'candidate'.
  try {
    await provisionAccount(admin, {
      userId,
      email,
      role: "employer",
      accountStatus: "invited",
      locale: preferredLocale,
    });
  } catch (error) {
    console.error(
      "Employer account provisioning failed",
      error instanceof ProvisioningError ? error.message : error
    );
    return { status: "error" };
  }

  const { error: memberError } = await supabase.from("company_members").insert({
    company_id: companyId,
    user_id: userId,
    member_role: "member",
  });
  if (memberError) return { status: "error" };

  revalidatePath(`/${locale}/admin/companies`);
  return { status: "success", inviteLink };
}

export interface ReviewActionState {
  status: "idle" | "success" | "error";
  decision?: "approved" | "rejected";
  itemId?: string;
}

/**
 * Revalidates every surface a review decision is visible on, so the item
 * leaves the pending queue and the history updates without a manual reload.
 */
function revalidateReviewSurfaces(locale: string, candidateId?: string) {
  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/admin/review`);
  revalidatePath(`/${locale}/admin/documents`);
  revalidatePath(`/${locale}/admin/candidates`);
  if (candidateId) {
    revalidatePath(`/${locale}/admin/candidates/${candidateId}`);
  }
}

/**
 * Approve or reject one change item (§10). The decision itself is executed by
 * the existing SECURITY DEFINER functions — approval applies the value to the
 * canonical model inside the database. Nothing is written directly from here.
 */
export async function reviewChangeItemAction(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "admin");

  const itemId = text(formData, "item_id");
  const approve = text(formData, "decision") === "approve";
  const comment = text(formData, "comment") || null;
  if (!itemId) return { status: "error" };

  const { error } = await supabase.rpc(
    approve ? "approve_change_item" : "reject_change_item",
    { p_item_id: itemId, p_comment: comment }
  );
  if (error) return { status: "error", itemId };

  revalidateReviewSurfaces(locale, text(formData, "candidate_id") || undefined);
  return {
    status: "success",
    decision: approve ? "approved" : "rejected",
    itemId,
  };
}

/**
 * Approve or reject a document (§13). Approval supersedes the previously
 * approved document of the same type — that rule lives in review_document()
 * and is left untouched.
 */
export async function reviewDocumentAction(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "admin");

  const documentId = text(formData, "document_id");
  const approve = text(formData, "decision") === "approve";
  const note = text(formData, "note") || null;
  if (!documentId) return { status: "error" };

  const { error } = await supabase.rpc("review_document", {
    p_document_id: documentId,
    p_approve: approve,
    p_note: note,
  });
  if (error) return { status: "error", itemId: documentId };

  revalidateReviewSurfaces(locale, text(formData, "candidate_id") || undefined);
  return {
    status: "success",
    decision: approve ? "approved" : "rejected",
    itemId: documentId,
  };
}

/**
 * Publish / unpublish an employer-facing profile (§5).
 *
 * The decision is executed by publish_candidate_profile() in the database,
 * which owns the prerequisite checks. Unmet prerequisites come back as a
 * canonical reason code that the UI turns into a clear sentence — the
 * action never bypasses the validation to force a publication through.
 */
export async function publishProfileAction(
  _prev: PublishActionState,
  formData: FormData
): Promise<PublishActionState> {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "admin");

  const candidateId = text(formData, "candidate_id");
  const publish = text(formData, "decision") === "publish";
  if (!candidateId) return { status: "error" };

  const { data, error } = await supabase.rpc("publish_candidate_profile", {
    p_candidate_id: candidateId,
    p_publish: publish,
  });

  if (error) {
    const reason = /PUBLISH_BLOCKED_[A-Z_]+/.exec(error.message)?.[0];
    return { status: "error", reason };
  }

  revalidatePath(`/${locale}/admin/candidates/${candidateId}`);
  revalidatePath(`/${locale}/admin/candidates`);
  return {
    status: "success",
    profileStatus: (data as { profile_status: ProfileStatus } | null)
      ?.profile_status,
  };
}

/**
 * Move an introduction request through the workflow (§17).
 *
 * Approval records that NORAV will facilitate the introduction. It does NOT
 * release candidate identity or contact data to the employer — that stays an
 * operational step, and no status here unlocks a private field (§18).
 */
export async function reviewInterestRequestAction(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const locale = text(formData, "locale");
  const { supabase } = await requireRole(locale, "admin");

  const requestId = text(formData, "request_id");
  const raw = text(formData, "next_status");
  if (!requestId) return { status: "error" };
  if (!(interestRequestStatuses as readonly string[]).includes(raw)) {
    return { status: "error", itemId: requestId };
  }
  const nextStatus = raw as InterestRequestStatus;
  const comment = text(formData, "comment") || null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("interest_requests")
    .update({
      status: nextStatus,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      ...(comment ? { review_comment: comment } : {}),
    })
    .eq("id", requestId);

  if (error) return { status: "error", itemId: requestId };

  // The status change is committed and a trigger has recorded the employer
  // event. E-mail is dispatched afterwards and best effort: a provider
  // failure is recorded on the event, never rolled back into the workflow.
  await dispatchNotificationEmails(supabase, requestId);

  revalidatePath(`/${locale}/admin/requests`);
  revalidatePath(`/${locale}/admin`);
  return {
    status: "success",
    decision: nextStatus === "rejected" ? "rejected" : "approved",
    itemId: requestId,
  };
}
