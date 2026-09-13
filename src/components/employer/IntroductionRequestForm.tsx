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
  jobs,
}: {
  profileId: string;
  existingStatus?: string;
  jobs: { id: string; title: string }[];
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
          <p className="t-body font-medium text-ink-800">{t("alreadySent")}</p>
        </div>
        <p className="t-meta mt-2">{t("noContactRelease")}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-lg border border-accent/30 bg-accent-soft p-5"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="profile_id" value={profileId} />

      <h2 className="t-section-title">{t("title")}</h2>
      <p className="t-body mt-1 max-w-2xl">{t("description")}</p>

      {jobs.length > 0 && (
        <div className="mt-4 max-w-sm">
          <label className="t-label mb-1.5 block" htmlFor="job_id">
            {t("jobLabel")}
          </label>
          <select id="job_id" name="job_id" className={controlClass}>
            <option value="">{t("noJob")}</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4">
        <label className="t-label mb-1.5 block" htmlFor="message">
          {t("messageLabel")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={2000}
          className={controlClass}
          placeholder={t("messagePlaceholder")}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? t("sending") : t("cta")}
        </button>
        <p className="t-meta">{t("noContactRelease")}</p>
      </div>

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-critical">
          {t("failed")}
        </p>
      )}
    </form>
  );
}
