import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/provider";
import { notificationEmail } from "@/lib/email/templates";
import { localeCodes, type LocaleCode } from "@/lib/domain";
import type { EmployerNotificationType } from "@/lib/notifications";

/**
 * Sends the e-mails for the notification events of one interest request.
 *
 * Runs AFTER the status transition has been committed. The database is the
 * source of truth (§13): this function never throws and never touches the
 * request status, so a provider outage cannot undo an admin's decision. Each
 * event row carries its own delivery state, and only rows still 'pending'
 * are picked up — which makes a retried server action, a double click or a
 * page refresh unable to send the same mail twice (§17).
 */
export async function dispatchNotificationEmails(
  supabase: SupabaseClient,
  interestRequestId: string
): Promise<void> {
  try {
    const { data: pending } = await supabase
      .from("employer_notifications")
      .select("id, type, company_id")
      .eq("interest_request_id", interestRequestId)
      .eq("email_status", "pending");

    const events = (pending ?? []) as {
      id: string;
      type: EmployerNotificationType;
      company_id: string;
    }[];
    if (events.length === 0) return;

    // Employer-safe labels only: the candidate code and the professional
    // target. There is no path here to a name, e-mail, phone or document.
    const { data: request } = await supabase
      .from("interest_requests")
      .select(
        `candidate_profiles(
           candidates(
             candidate_code, candidate_type,
             candidate_target_occupations(occupation, rank),
             skilled_worker_details(profession)
           )
         )`
      )
      .eq("id", interestRequestId)
      .maybeSingle();

    const candidate = (
      request as {
        candidate_profiles?: {
          candidates?: {
            candidate_code: string;
            candidate_type: string;
            candidate_target_occupations: { occupation: string; rank: number }[];
            skilled_worker_details: { profession: string | null } | null;
          } | null;
        } | null;
      } | null
    )?.candidate_profiles?.candidates;

    if (!candidate) return;

    const occupation =
      candidate.candidate_type === "apprenticeship_candidate"
        ? ([...candidate.candidate_target_occupations].sort(
            (a, b) => a.rank - b.rank
          )[0]?.occupation ?? null)
        : (candidate.skilled_worker_details?.profession ?? null);

    const { data: members } = await supabase
      .from("company_members")
      .select("app_users(email, preferred_locale)")
      .eq("company_id", events[0].company_id);

    const recipients = ((members ?? []) as unknown as {
      app_users: { email: string; preferred_locale: string } | null;
    }[])
      .map((row) => row.app_users)
      .filter((user): user is { email: string; preferred_locale: string } =>
        Boolean(user?.email)
      );

    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    for (const event of events) {
      const outcomes = await Promise.all(
        recipients.map((recipient) => {
          const locale = (localeCodes as readonly string[]).includes(
            recipient.preferred_locale
          )
            ? (recipient.preferred_locale as LocaleCode)
            : "de";
          const { subject, text } = notificationEmail(event.type, locale, {
            candidateCode: candidate.candidate_code,
            occupation,
            requestsUrl: `${site}/${locale}/employer/requests`,
          });
          return sendEmail({ to: [recipient.email], subject, text });
        })
      );

      const status = outcomes.some((o) => o.status === "failed")
        ? "failed"
        : outcomes.some((o) => o.status === "sent")
          ? "sent"
          : "skipped";

      const detail = outcomes.find(
        (o) => o.status === "failed" || o.status === "skipped"
      );
      const note =
        detail?.status === "failed"
          ? detail.error
          : detail?.status === "skipped"
            ? detail.reason
            : null;

      // Diagnostic only — never surfaced to an employer (§18).
      await supabase.rpc("record_notification_email", {
        p_notification_id: event.id,
        p_status: status,
        p_error: note,
      });
    }
  } catch {
    // Delivery is best effort by design. The events stay 'pending' and can
    // be retried later; the request status is already committed.
  }
}
