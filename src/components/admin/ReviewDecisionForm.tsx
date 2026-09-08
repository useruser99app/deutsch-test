"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  reviewChangeItemAction,
  reviewDocumentAction,
  type ReviewActionState,
} from "@/lib/actions/admin";
import { buttonClass, controlClass } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";

const initialState: ReviewActionState = { status: "idle" };

/**
 * Approve / reject with an optional comment, for a change item or a
 * document. The decision is executed by the existing database workflow
 * functions; this form only carries the reviewer's input and reports the
 * outcome. Buttons disable while the action runs, so a decision cannot be
 * submitted twice.
 */
export default function ReviewDecisionForm({
  kind,
  id,
  candidateId,
}: {
  kind: "change" | "document";
  id: string;
  candidateId?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("admin.review");
  const action = kind === "change" ? reviewChangeItemAction : reviewDocumentAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  const commentField = kind === "change" ? "comment" : "note";
  const idField = kind === "change" ? "item_id" : "document_id";

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-md border border-hairline bg-ink-50 px-3 py-2 text-sm text-ink-700"
      >
        <StatusBadge
          status={state.decision === "approved" ? "approved" : "rejected"}
          size="sm"
        />
        {state.decision === "approved" ? t("doneApproved") : t("doneRejected")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name={idField} value={id} />
      {candidateId && (
        <input type="hidden" name="candidate_id" value={candidateId} />
      )}

      {state.status === "error" && (
        <p
          role="alert"
          className="w-full rounded-md border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          {t("error")}
        </p>
      )}

      <div className="min-w-0 flex-1 basis-56">
        <label
          className="t-label mb-1.5 block"
          htmlFor={`${commentField}-${id}`}
        >
          {t("comment")}
        </label>
        <input
          id={`${commentField}-${id}`}
          type="text"
          name={commentField}
          maxLength={500}
          className={controlClass}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className={buttonClass("positive", "md")}
        >
          {pending ? t("working") : t("approve")}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className={buttonClass("critical", "md")}
        >
          {pending ? t("working") : t("reject")}
        </button>
      </div>
    </form>
  );
}
