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
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="request_id" value={requestId} />

      {/* The decision itself sits in the row, as in the operations
          reference. The internal note keeps its place in the same form
          behind a disclosure, so no capability is lost to the tighter
          layout. */}
      <div className="flex flex-wrap gap-1.5">
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
                  : next === "approved"
                    ? "primary"
                    : "secondary",
              "sm",
              "px-2.5 py-1 text-[13px]"
            )}
          >
            {t.has(`moveTo.${next}`) ? t(`moveTo.${next}`) : tStatus(next)}
          </button>
        ))}
      </div>

      <details className="group mt-1.5">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-medium text-ink-500 transition-colors hover:text-ink-800">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 transition-transform group-open:rotate-180"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          {t("commentLabel")}
        </summary>
        <label className="sr-only" htmlFor={`comment-${requestId}`}>
          {t("commentLabel")}
        </label>
        <input
          id={`comment-${requestId}`}
          name="comment"
          className={`${controlClass} mt-1.5 py-1.5 text-[13px] sm:text-[13px]`}
          placeholder={t("commentPlaceholder")}
          maxLength={500}
        />
      </details>

      {state.status === "error" && (
        <p role="alert" className="mt-1.5 text-[13px] text-critical">
          {t("failed")}
        </p>
      )}
    </form>
  );
}
