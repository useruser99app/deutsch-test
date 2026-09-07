"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  submitChangesAction,
  type CandidateFormState,
} from "@/lib/actions/candidate";
import {
  certificateStatuses,
  fieldSections,
  fieldsForSection,
  type CandidateFieldDef,
} from "@/lib/candidate-fields";
import { germanLevels, localeCodes, type CandidateType } from "@/lib/domain";

const initialState: CandidateFormState = { status: "idle" };

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 " +
  "focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:text-sm";

function defaultFor(value: unknown, field: CandidateFieldDef): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return String(value);
  if (field.input === "date" && typeof value === "string") {
    return value.slice(0, 10);
  }
  return String(value);
}

/**
 * Proposal form. Fields are prefilled with the APPROVED values; the server
 * action submits only what actually differs, and every difference becomes a
 * pending change item — canonical data is never written from here (§5).
 */
export default function ChangeForm({
  candidateType,
  approved,
  pendingKeys,
  defaultSourceLanguage,
}: {
  candidateType: CandidateType;
  approved: Record<string, unknown>;
  pendingKeys: string[];
  defaultSourceLanguage: string;
}) {
  const locale = useLocale();
  const t = useTranslations("candidate.changes");
  const tFields = useTranslations("fields");
  const tSections = useTranslations("candidate.sections");
  const tEnums = useTranslations("enums");
  const tStatus = useTranslations("status");
  const [state, formAction, pending] = useActionState(
    submitChangesAction,
    initialState
  );

  const pendingSet = new Set(pendingKeys);
  const hasFreeText = fieldSections.some((section) =>
    fieldsForSection(candidateType, section).some((field) => field.freeText)
  );

  function renderField(field: CandidateFieldDef) {
    const label = tFields.has(field.key) ? tFields(field.key) : field.key;
    const value = defaultFor(approved[field.key], field);
    const isPending = pendingSet.has(field.key);

    return (
      <div key={field.key}>
        <label
          className="mb-1 block text-sm font-medium text-gray-700"
          htmlFor={field.key}
        >
          {label}
        </label>

        {field.input === "textarea" ? (
          <textarea
            id={field.key}
            name={field.key}
            rows={4}
            defaultValue={value}
            className={inputClass}
          />
        ) : field.input === "boolean" ? (
          <select
            id={field.key}
            name={field.key}
            defaultValue={value}
            className={inputClass}
          >
            <option value="">{t("noChange")}</option>
            <option value="true">{tEnums("boolean.true")}</option>
            <option value="false">{tEnums("boolean.false")}</option>
          </select>
        ) : field.input === "german_level" ? (
          <select
            id={field.key}
            name={field.key}
            defaultValue={value}
            className={inputClass}
          >
            <option value="">{t("noChange")}</option>
            {germanLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        ) : field.input === "certificate_status" ? (
          <select
            id={field.key}
            name={field.key}
            defaultValue={value}
            className={inputClass}
          >
            <option value="">{t("noChange")}</option>
            {certificateStatuses.map((status) => (
              <option key={status} value={status}>
                {tEnums(`certificateStatus.${status}`)}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={field.key}
            type={
              field.input === "date"
                ? "date"
                : field.input === "number"
                  ? "number"
                  : "text"
            }
            inputMode={field.input === "number" ? "decimal" : undefined}
            step={field.input === "number" ? "any" : undefined}
            name={field.key}
            defaultValue={value}
            className={inputClass}
          />
        )}

        {field.input === "list" && (
          <p className="mt-1 text-xs text-gray-500">
            {field.key === "target_occupations"
              ? t("orderHint")
              : t("listHint")}
          </p>
        )}
        {isPending && (
          <p className="mt-1 text-xs text-amber-800">
            {tStatus("pending")} — {t("alreadyPending")}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />

      {state.status === "success" && (
        <p
          role="status"
          className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {t("submitted", { count: state.submittedCount ?? 0 })}
        </p>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.reason === "unchanged"
            ? t("errorUnchanged")
            : state.reason === "empty"
              ? t("errorEmpty")
              : t("errorFailed")}
        </p>
      )}

      {fieldSections.map((section) => {
        const fields = fieldsForSection(candidateType, section);
        if (fields.length === 0) return null;

        return (
          <fieldset
            key={section}
            className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"
          >
            <legend className="px-1 text-sm font-semibold text-gray-900">
              {tSections(section)}
            </legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={
                    field.input === "textarea" ? "sm:col-span-2" : undefined
                  }
                >
                  {renderField(field)}
                </div>
              ))}

              {section === "experience" && hasFreeText && (
                <div className="sm:col-span-2">
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="source_language"
                  >
                    {t("sourceLanguage")}
                  </label>
                  <select
                    id="source_language"
                    name="source_language"
                    defaultValue={defaultSourceLanguage}
                    className={inputClass}
                  >
                    {localeCodes.map((code) => (
                      <option key={code} value={code}>
                        {code.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {t("sourceLanguageHint")}
                  </p>
                </div>
              )}
            </div>
          </fieldset>
        );
      })}

      <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending ? t("submitting") : t("submit")}
        </button>
        <p className="mt-2 text-xs text-gray-500">{t("reviewNote")}</p>
      </div>
    </form>
  );
}
