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
import { buttonClass, controlClass } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";

const initialState: CandidateFormState = { status: "idle" };

const inputClass = controlClass;

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
        <label className="t-label mb-1.5 block" htmlFor={field.key}>
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
          <p className="t-meta mt-1.5">
            {field.key === "target_occupations" ? t("orderHint") : t("listHint")}
          </p>
        )}
        {isPending && (
          <p className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status="pending" size="sm" />
            <span className="t-meta">{t("alreadyPending")}</span>
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
          className="rounded-md border border-positive/25 bg-positive-soft px-4 py-3 text-sm text-positive"
        >
          {t("submitted", { count: state.submittedCount ?? 0 })}
        </p>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-md border border-critical/25 bg-critical-soft px-4 py-3 text-sm text-critical"
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
            className="rounded-lg border border-hairline bg-surface p-5 shadow-panel"
          >
            <legend className="t-section-title px-1">
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
                  <label className="t-label mb-1.5 block" htmlFor="source_language">
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
                  <p className="t-meta mt-1.5">{t("sourceLanguageHint")}</p>
                </div>
              )}
            </div>
          </fieldset>
        );
      })}

      <div className="sticky bottom-0 -mx-4 border-t border-hairline bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5 sm:shadow-panel">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "md", "w-full sm:w-auto")}
        >
          {pending ? t("submitting") : t("submit")}
        </button>
        <p className="t-meta mt-2">{t("reviewNote")}</p>
      </div>
    </form>
  );
}
