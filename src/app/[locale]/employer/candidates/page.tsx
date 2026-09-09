import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { loadMarketplace, type MarketplaceFilters } from "@/lib/employer-data";
import { germanLevels, type CandidateType } from "@/lib/domain";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import CandidateResult from "@/components/employer/CandidateResult";
import { buttonClass, controlClass } from "@/components/ui/button";
import { formatDateValue } from "@/components/ui/useValueFormatter";

type Search = Record<string, string | string[] | undefined>;

function one(search: Search, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function EmployerMarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");
  const search = await searchParams;

  const t = await getTranslations("employer.marketplace");
  const tFields = await getTranslations("fields");
  const tEnums = await getTranslations("enums");

  // Ausbildung is the default mode: it is NORAV's main candidate group.
  const candidateType: CandidateType =
    one(search, "type") === "skilled_worker"
      ? "skilled_worker"
      : "apprenticeship_candidate";
  const isApprenticeship = candidateType === "apprenticeship_candidate";

  const filters: MarketplaceFilters = {
    candidateType,
    germanLevel: one(search, "germanLevel") || undefined,
    location: one(search, "location") || undefined,
    relocationOnly: one(search, "relocation") === "1" || undefined,
    ...(isApprenticeship
      ? {
          occupation: one(search, "occupation") || undefined,
          trainingStartFrom: one(search, "startFrom") || undefined,
          schoolQualification: one(search, "qualification") || undefined,
          practicalExperience: one(search, "practical") === "1" || undefined,
        }
      : {
          profession: one(search, "profession") || undefined,
          minExperience: one(search, "minExperience")
            ? Number(one(search, "minExperience"))
            : undefined,
          availableFrom: one(search, "availableFrom") || undefined,
        }),
  };

  const { rows, truncated } = await loadMarketplace(supabase, filters);

  const formatDate = (value: string | null) => formatDateValue(value, locale);

  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== "candidateType" && value !== undefined
  );

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-ink-900 text-white"
        : "border border-hairline bg-surface text-ink-700 hover:bg-ink-50"
    }`;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/employer/candidates?type=apprenticeship_candidate"
          className={tabClass(isApprenticeship)}
        >
          {tEnums("candidateType.apprenticeship_candidate")}
        </Link>
        <Link
          href="/employer/candidates?type=skilled_worker"
          className={tabClass(!isApprenticeship)}
        >
          {tEnums("candidateType.skilled_worker")}
        </Link>
      </div>

      {/* Filters are a plain GET form: shareable URLs, no client state. */}
      <form method="get" className="mt-4">
        <input type="hidden" name="type" value={candidateType} />
        <Panel title={t("filters")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isApprenticeship ? (
              <>
                <div>
                  <label className="t-label mb-1.5 block" htmlFor="occupation">
                    {tFields("target_occupations")}
                  </label>
                  <input
                    id="occupation"
                    name="occupation"
                    defaultValue={one(search, "occupation")}
                    className={controlClass}
                    placeholder={t("occupationPlaceholder")}
                  />
                </div>
                <div>
                  <label className="t-label mb-1.5 block" htmlFor="startFrom">
                    {t("startFrom")}
                  </label>
                  <input
                    id="startFrom"
                    name="startFrom"
                    type="date"
                    defaultValue={one(search, "startFrom")}
                    className={controlClass}
                  />
                </div>
                <div>
                  <label
                    className="t-label mb-1.5 block"
                    htmlFor="qualification"
                  >
                    {tFields("school_qualification")}
                  </label>
                  <input
                    id="qualification"
                    name="qualification"
                    defaultValue={one(search, "qualification")}
                    className={controlClass}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="t-label mb-1.5 block" htmlFor="profession">
                    {tFields("profession")}
                  </label>
                  <input
                    id="profession"
                    name="profession"
                    defaultValue={one(search, "profession")}
                    className={controlClass}
                    placeholder={t("professionPlaceholder")}
                  />
                </div>
                <div>
                  <label
                    className="t-label mb-1.5 block"
                    htmlFor="minExperience"
                  >
                    {t("minExperience")}
                  </label>
                  <input
                    id="minExperience"
                    name="minExperience"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={one(search, "minExperience")}
                    className={controlClass}
                  />
                </div>
                <div>
                  <label
                    className="t-label mb-1.5 block"
                    htmlFor="availableFrom"
                  >
                    {t("availableFrom")}
                  </label>
                  <input
                    id="availableFrom"
                    name="availableFrom"
                    type="date"
                    defaultValue={one(search, "availableFrom")}
                    className={controlClass}
                  />
                </div>
              </>
            )}

            <div>
              <label className="t-label mb-1.5 block" htmlFor="germanLevel">
                {tFields("german_level")}
              </label>
              <select
                id="germanLevel"
                name="germanLevel"
                defaultValue={one(search, "germanLevel")}
                className={controlClass}
              >
                <option value="">{t("anyLevel")}</option>
                {germanLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="t-label mb-1.5 block" htmlFor="location">
                {t("preferredLocation")}
              </label>
              <input
                id="location"
                name="location"
                defaultValue={one(search, "location")}
                className={controlClass}
                placeholder={t("locationPlaceholder")}
              />
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  name="relocation"
                  value="1"
                  defaultChecked={one(search, "relocation") === "1"}
                  className="h-4 w-4 rounded border-hairline"
                />
                {tFields("relocation_ready")}
              </label>
              {isApprenticeship && (
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    name="practical"
                    value="1"
                    defaultChecked={one(search, "practical") === "1"}
                    className="h-4 w-4 rounded border-hairline"
                  />
                  {t("practicalExperience")}
                </label>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClass("primary", "sm")}>
              {t("apply")}
            </button>
            {hasFilters && (
              <Link
                href={`/employer/candidates?type=${candidateType}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("reset")}
              </Link>
            )}
          </div>
        </Panel>
      </form>

      <div className="mt-6">
        <Panel
          title={t("results", { count: rows.length })}
          description={truncated ? t("truncated") : undefined}
          bleed
        >
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                message={
                  hasFilters
                    ? t("noMatches")
                    : isApprenticeship
                      ? t("noApprenticeships")
                      : t("noSkilled")
                }
                compact
              />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {rows.map((candidate) => (
                <CandidateResult
                  key={candidate.profile_id}
                  candidate={candidate}
                  locale={locale}
                  formatDate={formatDate}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
