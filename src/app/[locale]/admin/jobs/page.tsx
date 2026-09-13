import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadAllJobs, loadRequestCountsByJob } from "@/lib/jobs-data";
import { formatDateValue } from "@/components/ui/useValueFormatter";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

/**
 * Operational oversight only (§9). The employer owns the vacancy; the admin
 * can see what exists and how much interest it carries, and edits nothing.
 */
export default async function AdminJobsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.jobs");
  const tJobs = await getTranslations("employer.jobs");
  const tEnums = await getTranslations("enums");

  const jobs = await loadAllJobs(supabase);
  const counts = await loadRequestCountsByJob(supabase, jobs.map((j) => j.id));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Panel bleed>
        {jobs.length === 0 ? (
          <div className="p-5">
            <EmptyState message={t("empty")} compact />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="t-label px-5 py-2.5 text-start">{t("company")}</th>
                  <th className="t-label px-3 py-2.5 text-start">{tJobs("jobTitle")}</th>
                  <th className="t-label px-3 py-2.5 text-start">{tJobs("jobType")}</th>
                  <th className="t-label px-3 py-2.5 text-start">{tJobs("location")}</th>
                  <th className="t-label px-3 py-2.5 text-start">{tJobs("status")}</th>
                  <th className="t-label px-3 py-2.5 text-start">{tJobs("created")}</th>
                  <th className="t-label px-5 py-2.5 text-start">{tJobs("linkedRequests")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {jobs.map((job) => (
                  <tr key={job.id} className="transition-colors hover:bg-ink-50">
                    <td className="px-5 py-2.5 text-sm font-medium text-ink-900">
                      <bdi>{job.companies?.name ?? "—"}</bdi>
                    </td>
                    <td className="px-3 py-2.5 text-sm"><bdi>{job.title}</bdi></td>
                    <td className="px-3 py-2.5 t-meta">{tEnums(`jobType.${job.job_type}`)}</td>
                    <td className="px-3 py-2.5 t-meta"><bdi>{job.location ?? "—"}</bdi></td>
                    <td className="px-3 py-2.5"><StatusBadge status={job.status} size="sm" /></td>
                    <td className="px-3 py-2.5 t-meta">{formatDateValue(job.created_at, locale)}</td>
                    <td className="px-5 py-2.5 text-sm tabular-nums text-ink-800">
                      {counts.get(job.id) ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="t-meta mt-4 max-w-2xl">{t("ownershipNote")}</p>
    </>
  );
}
