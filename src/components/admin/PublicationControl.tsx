"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { publishProfileAction } from "@/lib/actions/admin";
import type { PublishActionState } from "@/lib/domain";
import { buttonClass } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";

const initialState: PublishActionState = { status: "idle" };

/**
 * Publish / unpublish the employer-facing profile (§5).
 *
 * When the database refuses because a prerequisite is unmet, the canonical
 * reason code is translated into a plain sentence — the admin is told what
 * is missing instead of the publication being forced through.
 */
export default function PublicationControl({
  candidateId,
  profileStatus,
}: {
  candidateId: string;
  profileStatus: string;
}) {
  const locale = useLocale();
  const t = useTranslations("admin.publication");
  const [state, formAction, pending] = useActionState(
    publishProfileAction,
    initialState
  );

  const current = state.profileStatus ?? profileStatus;
  const isPublished = current === "published";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-2">
        <span className="t-label">{t("label")}</span>
        <StatusBadge status={current} />
      </div>

      <p className="t-meta max-w-md">
        {isPublished ? t("publishedHint") : t("unpublishedHint")}
      </p>

      <form action={formAction} className="ms-auto flex items-center gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="candidate_id" value={candidateId} />
        <input
          type="hidden"
          name="decision"
          value={isPublished ? "unpublish" : "publish"}
        />
        <button
          type="submit"
          disabled={pending}
          className={buttonClass(isPublished ? "secondary" : "primary", "sm")}
        >
          {pending
            ? t("working")
            : isPublished
              ? t("unpublish")
              : t("publish")}
        </button>
      </form>

      {state.status === "error" && (
        <p
          role="alert"
          className="w-full rounded-md border border-critical/30 bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          {state.reason && t.has(`blocked.${state.reason}`)
            ? t(`blocked.${state.reason}`)
            : t("failed")}
        </p>
      )}
    </div>
  );
}
