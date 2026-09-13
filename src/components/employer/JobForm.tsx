"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveJobAction, type JobActionState } from "@/lib/actions/employer";
import { germanLevels } from "@/lib/domain";
import { jobTypes, type Job } from "@/lib/jobs-data";
import { buttonClass, controlClass } from "@/components/ui/button";

const initialState: JobActionState = { status: "idle" };

/**
 * Vacancy form. The requirement fields follow the job type, because the two
 * hiring situations ask different questions: an apprenticeship asks when the
 * training starts, a skilled position asks how much experience is needed.
 * Years of experience is not offered for an apprenticeship at all (§6).
 */
export default function JobForm({ job }: { job?: Job }) {
  const locale = useLocale();
  const t = useTranslations("employer.jobs");
  const tFields = useTranslations("fields");
  const tEnums = useTranslations("enums");
  const [state, formAction, pending] = useActionState(saveJobAction, initialState);
  const [jobType, setJobType] = useState(job?.job_type ?? "apprenticeship");
  const isApprenticeship = jobType === "apprenticeship";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {job && <input type="hidden" name="job_id" value={job.id} />}

      {state.status === "error" && (
        <p role="alert" className="rounded-md border border-critical/25 bg-critical-soft px-4 py-3 text-sm text-critical">
          {t("saveFailed")}
        </p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">{t("basics")}</legend>

        <div className="sm:col-span-2">
          <label className="t-label mb-1.5 block" htmlFor="title">{t("jobTitle")}</label>
          <input id="title" name="title" required maxLength={160}
                 defaultValue={job?.title} className={controlClass} />
        </div>

        <div>
          <label className="t-label mb-1.5 block" htmlFor="job_type">{t("jobType")}</label>
          <select id="job_type" name="job_type" className={controlClass}
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as typeof jobType)}>
            {jobTypes.map((type) => (
              <option key={type} value={type}>{tEnums(`jobType.${type}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="t-label mb-1.5 block" htmlFor="occupation">
            {isApprenticeship ? t("targetOccupation") : tFields("profession")}
          </label>
          <input id="occupation" name="occupation" maxLength={120}
                 defaultValue={job?.profession_or_training_occupation ?? ""}
                 placeholder={isApprenticeship ? t("occupationPlaceholder") : t("professionPlaceholder")}
                 className={controlClass} />
        </div>

        <div>
          <label className="t-label mb-1.5 block" htmlFor="location">{t("location")}</label>
          <input id="location" name="location" maxLength={80}
                 defaultValue={job?.location ?? ""} className={controlClass} />
        </div>

        <div>
          <label className="t-label mb-1.5 block" htmlFor="country">{t("country")}</label>
          <input id="country" name="country" maxLength={2}
                 defaultValue={job?.country ?? "DE"} className={controlClass} />
        </div>

        <div>
          <label className="t-label mb-1.5 block" htmlFor="required_german_level">
            {t("requiredGerman")}
          </label>
          <select id="required_german_level" name="required_german_level"
                  defaultValue={job?.required_german_level ?? ""} className={controlClass}>
            <option value="">{t("noRequirement")}</option>
            {germanLevels.filter((l) => l !== "none").map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="t-label mb-1.5 block" htmlFor="training_start_date">
            {isApprenticeship ? t("trainingStart") : t("entryDate")}
          </label>
          <input id="training_start_date" name="training_start_date" type="date"
                 defaultValue={job?.training_start_date ?? ""} className={controlClass} />
        </div>

        {!isApprenticeship && (
          <>
            <div>
              <label className="t-label mb-1.5 block" htmlFor="minimum_experience_years">
                {t("minExperience")}
              </label>
              <input id="minimum_experience_years" name="minimum_experience_years"
                     type="number" min="0" step="0.5"
                     defaultValue={job?.minimum_experience_years ?? ""}
                     className={controlClass} />
            </div>
            <div>
              <label className="t-label mb-1.5 block" htmlFor="employment_type">
                {t("employmentType")}
              </label>
              <select id="employment_type" name="employment_type"
                      defaultValue={job?.employment_type ?? ""} className={controlClass}>
                <option value="">{t("notSpecified")}</option>
                {(["full_time", "part_time"] as const).map((v) => (
                  <option key={v} value={v}>
                    {tEnums.has(`employmentType.${v}`) ? tEnums(`employmentType.${v}`) : v}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label className="t-label mb-1.5 block" htmlFor="description">{t("descriptionLabel")}</label>
          <textarea id="description" name="description" rows={4} maxLength={4000}
                    defaultValue={job?.description ?? ""} className={controlClass} />
        </div>

        <div>
          <label className="t-label mb-1.5 block" htmlFor="status">{t("status")}</label>
          <select id="status" name="status" defaultValue={job?.status ?? "draft"}
                  className={controlClass}>
            {(["draft", "open", "closed"] as const).map((s) => (
              <option key={s} value={s}>{tEnums(`jobStatus.${s}`)}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? t("saving") : job ? t("save") : t("create")}
        </button>
        {state.status === "success" && (
          <span role="status" className="t-meta text-positive">{t("saved")}</span>
        )}
      </div>
    </form>
  );
}
