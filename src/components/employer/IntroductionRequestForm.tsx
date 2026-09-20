"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { requestIntroductionAction } from "@/lib/actions/employer";
import type { IntroductionActionState } from "@/lib/domain";
import { buttonClass, controlClass } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";

const initialState: IntroductionActionState = { status: "idle" };

/**
 * "Vorstellung anfragen" (§13). ALLEMARO handles the introduction itself, so
 * this form never asks for or reveals candidate contact data — it only
 * records that this company is interested.
 *
 * If an open request already exists, its status is shown instead of a second
 * primary action (§15); the submit button is also disabled while the action
 * runs, so a double click cannot create two requests.
 */
export default function IntroductionRequestForm({
  profileId,
  existingStatus,
  existingJobTitle,
  jobs,
  preselectedJobId,
}: {
  profileId: string;
  existingStatus?: string;
  /** Which vacancy the open request belongs to, if any. */
  existingJobTitle?: string | null;
  jobs: { id: string; title: string }[];
  /** Set when the employer arrived from a specific vacancy. */
  preselectedJobId?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("employer.introduction");
  const [state, formAction, pending] = useActionState(
    requestIntroductionAction,
    initialState
  );

  const settled =
    existingStatus ??
    (state.status === "success" || state.status === "duplicate"
      ? state.requestStatus
      : undefined);

  if (settled) {
    return (
      <div className="rounded-lg border border-hairline bg-ink-50 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={settled} />
          {/* Say where the request actually stands, not just that one
              exists. Copy only — the status values and the workflow that
              produces them are untouched. */}
          <p className="t-body font-medium text-ink-800">
            {t.has(`statusNote.${settled}`)
              ? t(`statusNote.${settled}`)
              : t("alreadySent")}
          </p>
        </div>
        {existingJobTitle && (
          <p className="t-meta mt-1.5">
            {t("forJob")}: <bdi>{existingJobTitle}</bdi>
          </p>
        )}
        <p className="t-meta mt-2">{t("noContactRelease")}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-control border border-accent/25 bg-accent-soft px-4 py-3.5"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="profile_id" value={profileId} />

      <h2 className="mk-section">{t("title")}</h2>
      <p className="mk-meta mt-1 max-w-[60ch]">{t("description")}</p>

      {jobs.length > 0 && (
        <div className="mt-3 max-w-sm">
          <label className="mk-label mb-1 block" htmlFor="job_id">
            {t("jobLabel")}
          </label>
          <select
            id="job_id"
            name="job_id"
            defaultValue={preselectedJobId ?? ""}
            className={controlClass}
          >
            <option value="">{t("noJob")}</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3">
        <label className="mk-label mb-1 block" htmlFor="message">
          {t("messageLabel")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={2}
          maxLength={2000}
          className={controlClass}
          placeholder={t("messagePlaceholder")}
        />
      </div>

      {/* The description above already states that no contact data is
          released; repeating it beside the button said the same thing
          twice on one screen. */}
      <div className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? t("sending") : t("cta")}
        </button>
      </div>

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-critical">
          {t("failed")}
        </p>
      )}
    </form>
  );
}
