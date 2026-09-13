"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  reviewInterestRequestAction,
  type ReviewActionState,
} from "@/lib/actions/admin";
import { buttonClass, controlClass } from "@/components/ui/button";
import type { InterestRequestStatus } from "@/lib/domain";

const initialState: ReviewActionState = { status: "idle" };

/**
 * Moves one introduction request through the workflow (§17). Only the
 * transitions that make sense from the current status are offered, so the
 * queue cannot be walked backwards by accident.
 *
 * None of these buttons releases candidate contact data (§18): "introduced"
 * records that ALLEMARO facilitated the contact operationally.
 */
const nextStates: Record<string, InterestRequestStatus[]> = {
  new: ["reviewing", "approved", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: ["introduced", "rejected"],
  rejected: [],
  introduced: [],
};

export default function RequestDecisionForm({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const locale = useLocale();
  const t = useTranslations("admin.requests");
  const tStatus = useTranslations("status");
  const [state, formAction, pending] = useActionState(
    reviewInterestRequestAction,
    initialState
  );

  const options = nextStates[status] ?? [];
  if (options.length === 0) {
    return <p className="t-meta">{t("closed")}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="request_id" value={requestId} />

      <label className="sr-only" htmlFor={`comment-${requestId}`}>
        {t("commentLabel")}
      </label>
      <input
        id={`comment-${requestId}`}
        name="comment"
        className={controlClass}
        placeholder={t("commentPlaceholder")}
        maxLength={500}
      />

      <div className="flex flex-wrap gap-2">
        {options.map((next) => (
          <button
            key={next}
            type="submit"
            name="next_status"
            value={next}
            disabled={pending}
            className={buttonClass(
              next === "rejected"
                ? "critical"
                : next === "introduced"
                  ? "positive"
                  : "secondary",
              "sm"
            )}
          >
            {t.has(`moveTo.${next}`)
              ? t(`moveTo.${next}`)
              : tStatus(next)}
          </button>
        ))}
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-critical">
          {t("failed")}
        </p>
      )}
    </form>
  );
}
