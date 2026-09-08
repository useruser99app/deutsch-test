"use client";

import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  uploadDocumentAction,
  type CandidateFormState,
} from "@/lib/actions/candidate";
import { documentTypes } from "@/lib/domain";
import { buttonClass, controlClass } from "@/components/ui/button";

const initialState: CandidateFormState = { status: "idle" };

export default function DocumentUploadForm() {
  const locale = useLocale();
  const t = useTranslations("candidate.documents");
  const tEnums = useTranslations("enums");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    uploadDocumentAction,
    initialState
  );

  const inputClass = controlClass;

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="locale" value={locale} />

      {state.status === "success" && (
        <p
          role="status"
          className="rounded-md border border-positive/25 bg-positive-soft px-4 py-3 text-sm text-positive"
        >
          {t("success")}
        </p>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-md border border-critical/25 bg-critical-soft px-4 py-3 text-sm text-critical"
        >
          {state.reason === "empty" ? t("errorNoFile") : t("error")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="t-label mb-1.5 block"
            htmlFor="document_type"
          >
            {t("documentType")}
          </label>
          <select
            id="document_type"
            name="document_type"
            className={inputClass}
            required
          >
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {tEnums(`documentType.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="t-label mb-1.5 block"
            htmlFor="file"
          >
            {t("file")}
          </label>
          <input
            id="file"
            type="file"
            name="file"
            required
            className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink-700 file:me-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-700"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "md", "w-full sm:w-auto")}
      >
        {pending ? t("uploading") : t("submit")}
      </button>
      <p className="t-meta">{t("uploadHint")}</p>
    </form>
  );
}
