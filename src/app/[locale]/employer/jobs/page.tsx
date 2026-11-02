import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  jobStatuses,
  jobTypes,
  loadJobs,
  loadRequestCountsByJob,
  type Job,
  type JobStatus,
  type JobType,
} from "@/lib/jobs-data";
import { loadOwnCompany } from "@/lib/employer-data";
import { countryName } from "@/components/ui/useValueFormatter";
import Icon, { type IconName } from "@/components/shell/Icon";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import OpsStatCard, { type OpsTone } from "@/components/admin/OpsStatCard";
import { buttonClass } from "@/components/ui/button";

type Search = Record<string, string | string[] | undefined>;
const one = (s: Search, k: string) =>
  (Array.isArray(s[k]) ? s[k]?.[0] : s[k])?.trim() ?? "";

/** Counter tone and glyph per vacancy status. */
const statusMeta: Record<JobStatus, { tone: OpsTone; icon: IconName }> = {
  open: { tone: "positive", icon: "jobs" },
  draft: { tone: "accent", icon: "changes" },
  closed: { tone: "neutral", icon: "close" },
  archived: { tone: "neutral", icon: "documents" },
};

/** Workflow order: what is live first, what is filed away last. */
const FLOW: JobStatus[] = ["open", "draft", "closed", "archived"];

const trackTile: Record<JobType, string> = {
  apprenticeship: "bg-track-apprenticeship-soft text-track-apprenticeship",
  skilled_position: "bg-track-skilled-soft text-track-skilled",
};

/**
 * The employer's vacancies in the Design System 2.0 language.
 *
 * Status and type filters work exactly as before — the same two URL
 * parameters with the same meaning. The vacancies are read once and the
 * filters are applied here, because the counters above the list have to
 * count ALL vacancies: a header whose numbers changed with every click
 * could not tell the employer where they stand.
 */
export default async function EmployerJobsPage({
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

  const t = await getTranslations("employer.jobs");
  const tEnums = await getTranslations("enums");
  const tStatus = await getTranslations("status");
  const format = await getFormatter();

  const rawStatus = one(search, "status");
  const rawType = one(search, "type");
  const status = (jobStatuses as readonly string[]).includes(rawStatus)
    ? (rawStatus as JobStatus)
    : undefined;
  const jobType = (jobTypes as readonly string[]).includes(rawType)
    ? (rawType as JobType)
    : undefined;

  const [all, company] = await Promise.all([
    loadJobs(supabase),
    loadOwnCompany(supabase),
  ]);
  const requestCounts = await loadRequestCountsByJob(
    supabase,
    all.map((job) => job.id),
  );

  const statusCounts = new Map<string, number>();
  for (const job of all) {
    statusCounts.set(job.status, (statusCounts.get(job.status) ?? 0) + 1);
  }

  const jobs = all.filter(
    (job) =>
      (!status || job.status === status) && (!jobType || job.job_type === jobType),
  );

  const href = (patch: { status?: string | null; type?: string | null }) => {
    const p = new URLSearchParams();
    const nextStatus = patch.status === undefined ? status : patch.status;
    const nextType = patch.type === undefined ? jobType : patch.type;
    if (nextStatus) p.set("status", nextStatus);
    if (nextType) p.set("type", nextType);
    const q = p.toString();
    return `/employer/jobs${q ? `?${q}` : ""}`;
  };

  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeZone: "UTC" });

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-[13px] font-medium transition-colors ${
      active
        ? "bg-ink-900 text-white"
        : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
    }`;
  const tabCount = (active: boolean) =>
    `rounded-pill px-1.5 text-[11px] font-semibold tabular-nums ${
      active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"
    }`;
  const typeTab = (active: boolean) =>
    `flex-1 whitespace-nowrap rounded-[0.375rem] px-3 py-1 text-center text-[13px] transition-colors md:flex-none ${
      active
        ? "bg-surface font-semibold text-ink-900 shadow-card"
        : "font-medium text-ink-500 hover:text-ink-800"
    }`;

  /** Requirement facts, only those the vacancy actually states. */
  const requirements = (job: Job): string[] => {
    const facts: string[] = [];
    if (job.required_german_level) {
      facts.push(t("germanValue", { level: job.required_german_level }));
    }
    if (job.job_type === "skilled_position" && job.minimum_experience_years !== null) {
      facts.push(t("experienceValue", { count: job.minimum_experience_years }));
    }
    if (job.employment_type) {
      facts.push(
        tEnums.has(`employmentType.${job.employment_type}`)
          ? tEnums(`employmentType.${job.employment_type}`)
          : job.employment_type,
      );
    }
    if (job.training_start_date) {
      const value = date(job.training_start_date);
      facts.push(
        job.job_type === "apprenticeship"
          ? t("startValue", { date: value })
          : t("entryValue", { date: value }),
      );
    }
    return facts;
  };

  // One grid for the header row and every data row, so the columns line up.
  const columns =
    "lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_5.5rem_8.5rem_12.5rem] lg:items-center lg:gap-x-5";

  return (
    <div data-shell="wide">
      <PageHeader
        eyebrow={company?.name ?? undefined}
        title={t("title")}
        description={t("description")}
        size="display"
        actions={
          <Link
            href="/employer/jobs/new"
            className={buttonClass("primary", "md")}
          >
            <span aria-hidden className="text-[1.05rem] leading-none">
              +
            </span>
            {t("create")}
          </Link>
        }
      />

      {/* ---- Counters: real totals, each one a status filter ------------ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <OpsStatCard
          label={t("kpiTotal")}
          hint={t("hintTotal")}
          value={all.length}
          href={href({ status: null })}
          icon="jobs"
          tone="neutral"
          active={!status}
        />
        {FLOW.map((value) => (
          <OpsStatCard
            key={value}
            label={tStatus(value)}
            hint={t(
              `hint${value.charAt(0).toUpperCase()}${value.slice(1)}` as
                | "hintOpen"
                | "hintDraft"
                | "hintClosed"
                | "hintArchived",
            )}
            value={statusCounts.get(value) ?? 0}
            href={href({ status: value })}
            icon={statusMeta[value].icon}
            tone={statusMeta[value].tone}
            active={status === value}
          />
        ))}
      </div>

      {/* ---- Toolbar: status segments and job type ----------------------
          On a phone the counters above already are the status filter, so
          the segments would only repeat them; the type switch stays. */}
      <div className="mt-4 rounded-card border border-hairline-strong bg-surface px-3 py-2.5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <nav className="hidden flex-wrap items-center gap-1 md:flex">
            <Link
              href={href({ status: null })}
              aria-current={!status ? "true" : undefined}
              className={tabClass(!status)}
            >
              {t("all")}
              <span className={tabCount(!status)}>{all.length}</span>
            </Link>
            {FLOW.map((value) => (
              <Link
                key={value}
                href={href({ status: value })}
                aria-current={status === value ? "true" : undefined}
                className={tabClass(status === value)}
              >
                {tStatus(value)}
                <span className={tabCount(status === value)}>
                  {statusCounts.get(value) ?? 0}
                </span>
              </Link>
            ))}
          </nav>

          <nav className="flex w-full flex-wrap rounded-control bg-canvas p-0.5 md:inline-flex md:w-auto">
            <Link
              href={href({ type: null })}
              aria-current={!jobType ? "true" : undefined}
              className={typeTab(!jobType)}
            >
              {t("allTypes")}
            </Link>
            {jobTypes.map((value) => (
              <Link
                key={value}
                href={href({ type: value })}
                aria-current={jobType === value ? "true" : undefined}
                className={typeTab(jobType === value)}
              >
                {tEnums(`jobType.${value}`)}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* ---- Vacancies -------------------------------------------------- */}
      <section className="mt-4 overflow-hidden rounded-card border border-hairline-strong bg-surface shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hairline bg-surface-sunken px-4 py-2">
          <h2 className="mk-section">{t("results", { count: jobs.length })}</h2>
          {(status || jobType) && (
            <Link
              href={href({ status: null, type: null })}
              className="text-[13px] font-medium text-accent hover:underline"
            >
              {t("resetFilters")}
            </Link>
          )}
        </header>

        {jobs.length === 0 ? (
          <div className="px-5 py-5">
            <EmptyState
              message={status || jobType ? t("noneForFilter") : t("empty")}
              action={
                status || jobType ? undefined : (
                  <Link
                    href="/employer/jobs/new"
                    className={buttonClass("secondary", "sm")}
                  >
                    {t("create")}
                  </Link>
                )
              }
              compact
            />
          </div>
        ) : (
          <>
            {/* Column labels exist only where there are columns. */}
            <div
              aria-hidden
              className={`hidden border-b border-hairline px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-500 ${columns}`}
            >
              <span>{t("colJob")}</span>
              <span>{t("requirements")}</span>
              <span className="text-end">{t("linkedRequests")}</span>
              <span>{t("status")}</span>
              <span className="text-end">{t("colActions")}</span>
            </div>

            <ul className="divide-y divide-hairline">
              {jobs.map((job) => {
                const facts = requirements(job);
                const requests = requestCounts.get(job.id) ?? 0;
                // Each part isolated on its own: a German city next to an
                // Arabic country name must not be reordered as one string.
                const place = [
                  job.location,
                  job.country ? countryName(job.country, locale) : null,
                ].filter((part): part is string => Boolean(part));

                return (
                  <li
                    key={job.id}
                    className={`px-4 py-3.5 transition-colors hover:bg-surface-sunken ${columns}`}
                  >
                    {/* 1 + 2: title, then type, place and (narrow) status */}
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${trackTile[job.job_type]}`}
                      >
                        <Icon name="jobs" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/employer/jobs/${job.id}`}
                            className="min-w-0 text-[15px] font-semibold leading-5 text-ink-900 hover:text-accent hover:underline"
                          >
                            <bdi>{job.title}</bdi>
                          </Link>
                          <span className="lg:hidden">
                            <StatusBadge status={job.status} size="sm" />
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4 text-ink-500">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${trackTile[job.job_type]}`}
                          >
                            {tEnums(`jobType.${job.job_type}`)}
                          </span>
                          {place.length > 0 && (
                            <span>
                              {place.map((part, index) => (
                                <span key={part}>
                                  {index > 0 && ", "}
                                  <bdi>{part}</bdi>
                                </span>
                              ))}
                            </span>
                          )}
                          <span className="lg:hidden">
                            {t("created")} {date(job.created_at)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* 3: requirements */}
                    <div className="mt-2.5 ps-12 lg:mt-0 lg:ps-0">
                      {facts.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {facts.map((fact) => (
                            <li
                              key={fact}
                              className="rounded-control border border-hairline bg-surface px-2 py-0.5 text-[12px] leading-5 text-ink-700"
                            >
                              <bdi>{fact}</bdi>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[12px] text-ink-400">
                          {t("noRequirements")}
                        </span>
                      )}
                    </div>

                    {/* 4: requests, status, actions */}
                    <div className="mt-3 flex items-center justify-between gap-3 ps-12 lg:contents">
                      <span className="flex items-baseline gap-1.5 lg:justify-end">
                        <span className="text-[12px] text-ink-500 lg:hidden">
                          {t("linkedRequests")}
                        </span>
                        <span
                          className={`text-[15px] font-semibold tabular-nums ${
                            requests > 0 ? "text-ink-900" : "text-ink-400"
                          }`}
                        >
                          {requests}
                        </span>
                      </span>

                      <span className="hidden lg:block">
                        <StatusBadge status={job.status} size="sm" />
                        <span className="mt-1 block text-[12px] leading-4 text-ink-500">
                          {t("created")} {date(job.created_at)}
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-1.5 lg:justify-end">
                        <Link
                          href={`/employer/jobs/${job.id}?edit=1`}
                          className={buttonClass("ghost", "sm")}
                        >
                          {t("edit")}
                        </Link>
                        <Link
                          href={`/employer/jobs/${job.id}`}
                          className={buttonClass("secondary", "sm")}
                        >
                          {t("openJob")}
                          <span aria-hidden className="rtl:rotate-180">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-3.5 w-3.5"
                            >
                              <path d="m9 6 6 6-6 6" />
                            </svg>
                          </span>
                        </Link>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {all.length >= 200 && (
              <p className="border-t border-hairline bg-surface-sunken px-4 py-2 text-[12px] text-ink-500">
                {t("capped")}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
