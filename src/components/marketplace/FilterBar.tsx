import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { germanLevels } from "@/lib/domain";

import SearchInput from "@/components/marketplace/SearchInput";
import {
  marketplaceHref,
  param,
  type MarketplaceSearch,
} from "@/lib/marketplace-url";

/**
 * One height for every control in the bar. Defined here rather than in the
 * shared `controlClass` so the forms elsewhere in the product keep theirs.
 */
const barField =
  "h-10 w-full rounded-control border border-hairline bg-surface px-3 text-sm " +
  "text-ink-900 transition-colors hover:border-hairline-strong " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * The marketplace filter bar.
 *
 * Compact on purpose: the one question an employer arrives with (which
 * occupation) plus the two that immediately follow (German level, vacancy
 * context) stay on the first row; everything else lives behind a native
 * <details> disclosure that opens itself when one of its filters is set, so
 * an active filter can never hide.
 *
 * Still a plain GET form — the same workflow as before the redesign, and
 * therefore the same shareable URLs. Only the presentation changed.
 */
export default function FilterBar({
  search,
  candidateType,
  jobs,
  moreOpen,
}: {
  search: MarketplaceSearch;
  candidateType: string;
  /** The employer's own vacancies, for the optional matching context. */
  jobs: { id: string; title: string }[];
  /** Open the secondary filters because at least one of them is active. */
  moreOpen: boolean;
}) {
  const t = useTranslations("employer.marketplace");
  const tFields = useTranslations("fields");
  const tEnums = useTranslations("enums");
  const isApprenticeship = candidateType === "apprenticeship_candidate";

  const tab = (type: string, label: string) => {
    const active = candidateType === type;
    return (
      <Link
        href={marketplaceHref(search, { type, selected: null })}
        aria-current={active ? "true" : undefined}
        className={`rounded-[0.375rem] px-3 py-1 text-[13px] transition-colors ${
          active
            ? "bg-surface font-semibold text-ink-900 shadow-card"
            : "font-medium text-ink-500 hover:text-ink-800"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <section className="rounded-card border border-hairline-strong bg-surface px-3.5 py-3 shadow-card">
      <form method="get">
        <input type="hidden" name="type" value={candidateType} />

        <div className="flex flex-wrap items-center gap-2">
          {/* Candidate type is navigation, not a form field: it changes which
              filters exist, so it reloads rather than waiting for a submit.
              It sits in the same row as the fields — as its own row it cost
              the marketplace a full line of height for two words. */}
          <div className="inline-flex shrink-0 rounded-control bg-canvas p-0.5">
            {tab(
              "apprenticeship_candidate",
              tEnums("candidateType.apprenticeship_candidate"),
            )}
            {tab("skilled_worker", tEnums("candidateType.skilled_worker"))}
          </div>

          {isApprenticeship ? (
            <SearchInput
              id="occupation"
              name="occupation"
              label={tFields("target_occupations")}
              placeholder={t("occupationPlaceholder")}
              defaultValue={param(search, "occupation")}
            />
          ) : (
            <SearchInput
              id="profession"
              name="profession"
              label={tFields("profession")}
              placeholder={t("professionPlaceholder")}
              defaultValue={param(search, "profession")}
            />
          )}

          <div className="w-full sm:w-32">
            <label className="sr-only" htmlFor="germanLevel">
              {tFields("german_level")}
            </label>
            <select
              id="germanLevel"
              name="germanLevel"
              defaultValue={param(search, "germanLevel")}
              className={barField}
            >
              <option value="">{t("anyLevel")}</option>
              {germanLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          {/* Matching needs a vacancy to compare against. */}
          {jobs.length > 0 && (
            <div className="w-full sm:w-52">
              <label className="sr-only" htmlFor="job">
                {t("jobContext")}
              </label>
              <select
                id="job"
                name="job"
                defaultValue={param(search, "job")}
                className={barField}
              >
                <option value="">{t("noJobContext")}</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            className="h-10 shrink-0 rounded-control bg-ink-900 px-4 text-sm font-medium text-white transition-colors hover:bg-ink-800"
          >
            {t("apply")}
          </button>
        </div>

        <details open={moreOpen} className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-800">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            {t("moreFilters")}
          </summary>

          {/* A flat row, not a grid of stacked label/field pairs: the label
              sits beside its control, so the secondary filters cost one
              line instead of three. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-hairline pt-2.5">
            {isApprenticeship ? (
              <>
                <Field id="startFrom" label={t("startFrom")}>
                  <input
                    id="startFrom"
                    name="startFrom"
                    type="date"
                    defaultValue={param(search, "startFrom")}
                    className={`${barField} w-auto`}
                  />
                </Field>
                <Field
                  id="qualification"
                  label={tFields("school_qualification")}
                >
                  <input
                    id="qualification"
                    name="qualification"
                    defaultValue={param(search, "qualification")}
                    className={`${barField} w-32`}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field id="minExperience" label={t("minExperience")}>
                  <input
                    id="minExperience"
                    name="minExperience"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={param(search, "minExperience")}
                    className={`${barField} w-20`}
                  />
                </Field>
                <Field id="availableFrom" label={t("availableFrom")}>
                  <input
                    id="availableFrom"
                    name="availableFrom"
                    type="date"
                    defaultValue={param(search, "availableFrom")}
                    className={`${barField} w-auto`}
                  />
                </Field>
              </>
            )}

            <Field id="location" label={t("preferredLocation")}>
              <input
                id="location"
                name="location"
                defaultValue={param(search, "location")}
                className={`${barField} w-32`}
                placeholder={t("locationPlaceholder")}
              />
            </Field>

            <label className="flex items-center gap-2 text-[13px] text-ink-700">
              <input
                type="checkbox"
                name="relocation"
                value="1"
                defaultChecked={param(search, "relocation") === "1"}
                className="h-4 w-4 rounded border-hairline"
              />
              {tFields("relocation_ready")}
            </label>
            {isApprenticeship && (
              <label className="flex items-center gap-2 text-[13px] text-ink-700">
                <input
                  type="checkbox"
                  name="practical"
                  value="1"
                  defaultChecked={param(search, "practical") === "1"}
                  className="h-4 w-4 rounded border-hairline"
                />
                {t("practicalExperience")}
              </label>
            )}
          </div>
        </details>
      </form>
    </section>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="mk-label whitespace-nowrap" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
