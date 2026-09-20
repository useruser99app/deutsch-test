import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadActiveRequest,
  loadCompanyJobs,
  loadEmployerCandidate,
  loadEmployerRequests,
  loadMarketplace,
  loadPublicNarrative,
  type MarketplaceFilters,
} from "@/lib/employer-data";
import { loadJob } from "@/lib/jobs-data";
import {
  activeInterestRequestStatuses,
  type CandidateType,
} from "@/lib/domain";
import { evaluateCandidateForJob, type FitResult } from "@/lib/matching";
import {
  activeFilterKeys,
  marketplaceHref,
  param,
  resetFiltersHref,
  type MarketplaceSearch,
} from "@/lib/marketplace-url";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/marketplace/FilterBar";
import FilterChip from "@/components/marketplace/FilterChip";
import CandidateListItem from "@/components/marketplace/CandidateListItem";
import CandidatePreview from "@/components/marketplace/CandidatePreview";
import { formatDateValue } from "@/components/ui/useValueFormatter";

/**
 * The employer candidate marketplace — the Design System 2.0 pilot.
 *
 * Desktop is a list beside a preview; below `lg` the two become one view at
 * a time, because a 390px screen cannot show both without making each
 * useless. Which one is visible follows from the URL alone, so there is no
 * client state, no layout flash and no second source of truth.
 *
 * Everything shown here comes from `employer_candidate_profiles`, the view
 * whose column list IS the publication whitelist. No private identity is
 * loaded, so none can be rendered.
 */
export default async function EmployerMarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<MarketplaceSearch>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");
  const search = await searchParams;

  const t = await getTranslations("employer.marketplace");
  const tFields = await getTranslations("fields");

  // Ausbildung is the default mode: it is ALLEMARO's main candidate group.
  const candidateType: CandidateType =
    param(search, "type") === "skilled_worker"
      ? "skilled_worker"
      : "apprenticeship_candidate";
  const isApprenticeship = candidateType === "apprenticeship_candidate";

  const filters: MarketplaceFilters = {
    candidateType,
    germanLevel: param(search, "germanLevel") || undefined,
    location: param(search, "location") || undefined,
    relocationOnly: param(search, "relocation") === "1" || undefined,
    ...(isApprenticeship
      ? {
          occupation: param(search, "occupation") || undefined,
          trainingStartFrom: param(search, "startFrom") || undefined,
          schoolQualification: param(search, "qualification") || undefined,
          practicalExperience: param(search, "practical") === "1" || undefined,
        }
      : {
          profession: param(search, "profession") || undefined,
          minExperience: param(search, "minExperience")
            ? Number(param(search, "minExperience"))
            : undefined,
          availableFrom: param(search, "availableFrom") || undefined,
        }),
  };

  const jobId = param(search, "job");

  const [{ rows, truncated }, jobs, requests, job] = await Promise.all([
    loadMarketplace(supabase, filters),
    loadCompanyJobs(supabase),
    loadEmployerRequests(supabase),
    // RLS scopes this to the employer's own company — another company's
    // vacancy simply does not exist for this session.
    jobId ? loadJob(supabase, jobId) : Promise.resolve(null),
  ]);

  /**
   * The company's own open request per candidate. Read from the requests the
   * employer already sees on their requests page — no new access path, and
   * nothing about other companies' interest is visible.
   */
  const openRequestByCandidate = new Map<string, string>();
  for (const request of requests) {
    if (
      (activeInterestRequestStatuses as readonly string[]).includes(
        request.status,
      )
    ) {
      openRequestByCandidate.set(request.candidate_profile_id, request.status);
    }
  }

  /**
   * Matching needs something to match AGAINST. Without a vacancy there is no
   * requirement to compare a profile to, so no band is shown at all rather
   * than a made-up one. With a vacancy the existing evaluation runs
   * unchanged — same function, same criteria, same evidence.
   *
   * The result order stays `published_at` either way: this is a marketplace
   * the employer filters, not a ranked recommendation feed.
   */
  const fitByCandidate = new Map<string, FitResult>();
  if (job) {
    for (const candidate of rows) {
      const fit = evaluateCandidateForJob(job, candidate);
      if (fit.eligible) fitByCandidate.set(candidate.profile_id, fit);
    }
  }

  // No explicit selection on a wide screen still shows a preview: the first
  // result. On a narrow screen the absence of the parameter is what keeps
  // the list, and only the list, on screen.
  const selectedParam = param(search, "selected");
  const selectedId =
    (selectedParam && rows.some((row) => row.profile_id === selectedParam)
      ? selectedParam
      : "") ||
    rows[0]?.profile_id ||
    "";
  const hasExplicitSelection = Boolean(selectedParam);

  const selected = selectedId
    ? await loadEmployerCandidate(supabase, selectedId)
    : null;

  const [narrative, activeRequest] = selected
    ? await Promise.all([
        loadPublicNarrative(supabase, selected.profile_id, locale),
        loadActiveRequest(supabase, selected.profile_id),
      ])
    : [null, null];

  const formatDate = (value: string | null) => formatDateValue(value, locale);

  // One chip per active filter, each removable on its own.
  const chipLabels: Record<string, string> = {
    occupation: tFields("target_occupations"),
    profession: tFields("profession"),
    germanLevel: tFields("german_level"),
    location: t("preferredLocation"),
    startFrom: t("startFrom"),
    qualification: tFields("school_qualification"),
    availableFrom: t("availableFrom"),
    minExperience: t("minExperience"),
    relocation: tFields("relocation_ready"),
    practical: t("practicalExperience"),
  };
  const chips = activeFilterKeys(search).map((key) => {
    const raw = param(search, key);
    return {
      key,
      label: chipLabels[key] ?? key,
      // A checkbox filter reads as its own label, not as "1".
      value: key === "relocation" || key === "practical" ? t("yes") : raw,
      href: marketplaceHref(search, { [key]: null, selected: null }),
    };
  });

  const listOnlyClass = hasExplicitSelection ? "hidden lg:block" : "block";
  const previewOnlyClass = hasExplicitSelection ? "block" : "hidden lg:block";

  return (
    <>
      {/* Below `lg` a chosen candidate IS the view: the title block and the
          filters step aside so the profile starts at the top of the screen,
          and the preview's own back link returns to the list. */}
      <div className={listOnlyClass}>
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("headline")}
          description={t("subtitle")}
          size="display"
        />

        <FilterBar
          search={search}
          candidateType={candidateType}
          jobs={jobs}
          moreOpen={chips.some((chip) =>
            [
              "location",
              "startFrom",
              "qualification",
              "availableFrom",
              "minExperience",
              "relocation",
              "practical",
            ].includes(chip.key),
          )}
        />

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                value={chip.value}
                removeHref={chip.href}
                removeLabel={t("removeFilter")}
              />
            ))}
            <Link
              href={resetFiltersHref(search)}
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("resetAll")}
            </Link>
          </div>
        )}
      </div>

      <div className="mt-stack lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---- Result list ------------------------------------------- */}
        <section className={listOnlyClass}>
          <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hairline bg-surface-sunken px-4 py-2.5">
              <h2 className="t-section-title">
                {t("results", { count: rows.length })}
              </h2>
              {truncated && <p className="t-meta">{t("truncated")}</p>}
            </header>

            {rows.length === 0 ? (
              <div className="p-card">
                <EmptyState
                  message={
                    chips.length > 0
                      ? t("noMatches")
                      : isApprenticeship
                        ? t("noApprenticeships")
                        : t("noSkilled")
                  }
                  action={
                    chips.length > 0 ? (
                      <Link
                        href={resetFiltersHref(search)}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {t("resetAll")}
                      </Link>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <ul>
                {rows.map((candidate) => (
                  <CandidateListItem
                    key={candidate.profile_id}
                    candidate={candidate}
                    href={marketplaceHref(search, {
                      selected: candidate.profile_id,
                    })}
                    selected={candidate.profile_id === selectedId}
                    locale={locale}
                    formatDate={formatDate}
                    fit={fitByCandidate.get(candidate.profile_id)}
                    requestStatus={openRequestByCandidate.get(
                      candidate.profile_id,
                    )}
                  />
                ))}
              </ul>
            )}
          </div>

          {rows.length > 0 && (
            <p className="t-meta mt-2.5 px-1">{t("privacyNote")}</p>
          )}
        </section>

        {/* ---- Preview ----------------------------------------------- */}
        <aside
          className={`${previewOnlyClass} lg:sticky lg:top-5 mt-4 lg:mt-0`}
          aria-label={t("previewLabel")}
        >
          {selected ? (
            <div className="lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto">
              <CandidatePreview
                candidate={selected}
                narrative={narrative}
                activeRequest={activeRequest}
                jobs={jobs}
                locale={locale}
                fit={fitByCandidate.get(selected.profile_id)}
                jobTitle={job?.title}
                preselectedJobId={jobId || undefined}
                variant="panel"
                fullProfileHref={`/employer/candidates/${selected.profile_id}${
                  jobId ? `?job=${jobId}` : ""
                }`}
                backHref={marketplaceHref(search, { selected: null })}
              />
            </div>
          ) : (
            <div className="rounded-card border border-dashed border-hairline-strong bg-surface p-card">
              <p className="t-body text-ink-500">{t("previewEmpty")}</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
