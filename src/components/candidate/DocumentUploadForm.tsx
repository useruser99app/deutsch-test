"use client";

import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  uploadDocumentAction,
  type CandidateFormState,
} from "@/lib/actions/candidate";
import { documentTypes } from "@/lib/domain";

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

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 " +
    "focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:text-sm";

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
          className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {t("success")}
        </p>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.reason === "empty" ? t("errorNoFile") : t("error")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
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
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="file"
          >
            {t("file")}
          </label>
          <input
            id="file"
            type="file"
            name="file"
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:text-gray-700"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? t("uploading") : t("submit")}
      </button>
      <p className="text-xs text-gray-500">{t("uploadHint")}</p>
    </form>
  );
}
