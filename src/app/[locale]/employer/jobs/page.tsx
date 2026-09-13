import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  jobStatuses,
  jobTypes,
  loadJobs,
  loadRequestCountsByJob,
  type JobFilters,
} from "@/lib/jobs-data";
import { formatDateValue } from "@/components/ui/useValueFormatter";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonClass } from "@/components/ui/button";

type Search = Record<string, string | string[] | undefined>;
const one = (s: Search, k: string) =>
  (Array.isArray(s[k]) ? s[k]?.[0] : s[k])?.trim() ?? "";

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
  const tFields = await getTranslations("fields");

  const rawStatus = one(search, "status");
  const rawType = one(search, "type");
  const filters: JobFilters = {
    ...((jobStatuses as readonly string[]).includes(rawStatus)
      ? { status: rawStatus as JobFilters["status"] }
      : {}),
    ...((jobTypes as readonly string[]).includes(rawType)
      ? { jobType: rawType as JobFilters["jobType"] }
      : {}),
  };

  const jobs = await loadJobs(supabase, filters);
  const counts = await loadRequestCountsByJob(supabase, jobs.map((j) => j.id));

  const chip = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-ink-900 text-white"
        : "border border-hairline bg-surface text-ink-700 hover:bg-ink-50"
    }`;
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (filters.status) p.set("status", filters.status);
    if (filters.jobType) p.set("type", filters.jobType);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const q = p.toString();
    return `/employer/jobs${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/employer/jobs/new" className={buttonClass("primary", "sm")}>
            {t("create")}
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link href={href({ status: "", type: "" })} className={chip(!filters.status && !filters.jobType)}>
          {t("all")}
        </Link>
        {jobStatuses.filter((s) => s !== "archived").map((s) => (
          <Link key={s} href={href({ status: filters.status === s ? "" : s })} className={chip(filters.status === s)}>
            {tEnums(`jobStatus.${s}`)}
          </Link>
        ))}
        {jobTypes.map((ty) => (
          <Link key={ty} href={href({ type: filters.jobType === ty ? "" : ty })} className={chip(filters.jobType === ty)}>
            {tEnums(`jobType.${ty}`)}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <Panel bleed>
          {jobs.length === 0 ? (
            <div className="p-5">
              <EmptyState
                message={filters.status || filters.jobType ? t("noneForFilter") : t("empty")}
                compact
              />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {jobs.map((job) => (
                <li key={job.id} className="px-5 py-3.5 transition-colors hover:bg-ink-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={`/employer/jobs/${job.id}`}
                          className="t-entity hover:text-accent hover:underline"
                        >
                          <bdi>{job.title}</bdi>
                        </Link>
                        <span className="t-meta">{tEnums(`jobType.${job.job_type}`)}</span>
                      </div>
                      <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                        {job.location && <Fact label={t("location")} value={job.location} />}
                        {job.required_german_level && (
                          <Fact label={tFields("german_level")} value={job.required_german_level} />
                        )}
                        {job.training_start_date && (
                          <Fact
                            label={job.job_type === "apprenticeship" ? t("trainingStart") : t("entryDate")}
                            value={formatDateValue(job.training_start_date, locale) ?? ""}
                          />
                        )}
                        {(counts.get(job.id) ?? 0) > 0 && (
                          <Fact label={t("linkedRequests")} value={String(counts.get(job.id))} />
                        )}
                        <Fact label={t("created")} value={formatDateValue(job.created_at, locale) ?? ""} />
                      </dl>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={job.status} size="sm" />
                      <Link
                        href={`/employer/jobs/${job.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {t("openJob")}
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="t-meta">{label}:</dt>
      <dd className="text-sm font-medium text-ink-800"><bdi>{value}</bdi></dd>
    </div>
  );
}
