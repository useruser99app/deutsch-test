"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  reviewChangeItemAction,
  reviewDocumentAction,
  type ReviewActionState,
} from "@/lib/actions/admin";

const initialState: ReviewActionState = { status: "idle" };

/**
 * Approve / reject with an optional comment, for a change item or a
 * document. The decision is executed by the existing database workflow
 * functions; this form only carries the reviewer's input and shows the
 * outcome. The buttons disable while the action runs, so a decision cannot
 * be submitted twice.
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
        className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700"
      >
        {state.decision === "approved" ? t("doneApproved") : t("doneRejected")}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name={idField} value={id} />
      {candidateId && (
        <input type="hidden" name="candidate_id" value={candidateId} />
      )}

      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {t("error")}
        </p>
      )}

      <div>
        <label
          className="mb-1 block text-xs font-medium text-gray-600"
          htmlFor={`${commentField}-${id}`}
        >
          {t("comment")}
        </label>
        <input
          id={`${commentField}-${id}`}
          type="text"
          name={commentField}
          maxLength={500}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="flex-1 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
        >
          {pending ? t("working") : t("approve")}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
        >
          {pending ? t("working") : t("reject")}
        </button>
      </div>
    </form>
  );
}
