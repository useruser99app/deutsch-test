import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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
  const counts = await loadRequestCountsByJob(
    supabase,
    jobs.map((j) => j.id),
  );

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
                  <th className="t-label px-5 py-2.5 text-start">
                    {t("company")}
                  </th>
                  <th className="t-label px-3 py-2.5 text-start">
                    {tJobs("jobTitle")}
                  </th>
                  <th className="t-label px-3 py-2.5 text-start">
                    {tJobs("jobType")}
                  </th>
                  <th className="t-label px-3 py-2.5 text-start">
                    {tJobs("location")}
                  </th>
                  <th className="t-label px-3 py-2.5 text-start">
                    {tJobs("status")}
                  </th>
                  <th className="t-label px-3 py-2.5 text-start">
                    {tJobs("created")}
                  </th>
                  <th className="t-label px-5 py-2.5 text-start">
                    {tJobs("linkedRequests")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {jobs.map((job) => {
                  const href = `/admin/jobs/${job.id}`;
                  /**
                   * A table row cannot be a link, so every cell carries one
                   * to the same detail page and the padding sits on the link:
                   * the whole row is the target, with no dead gaps. Only the
                   * title link is focusable and announced; the others are
                   * removed from the tab order so a keyboard user meets one
                   * stop per row, not seven.
                   */
                  const cell = (
                    content: React.ReactNode,
                    className: string,
                    primary = false,
                  ) => (
                    <Link
                      href={href}
                      tabIndex={primary ? undefined : -1}
                      aria-hidden={primary ? undefined : true}
                      className={`block ${className}`}
                    >
                      {content}
                    </Link>
                  );
                  return (
                    <tr
                      key={job.id}
                      className="group cursor-pointer transition-colors hover:bg-surface-sunken"
                    >
                      <td className="p-0 text-sm font-medium text-ink-900">
                        {cell(
                          <bdi>{job.companies?.name ?? "—"}</bdi>,
                          "px-5 py-2.5",
                        )}
                      </td>
                      <td className="p-0 text-sm">
                        {cell(
                          <bdi className="group-hover:text-accent">
                            {job.title}
                          </bdi>,
                          "px-3 py-2.5",
                          true,
                        )}
                      </td>
                      <td className="p-0 t-meta">
                        {cell(tEnums(`jobType.${job.job_type}`), "px-3 py-2.5")}
                      </td>
                      <td className="p-0 t-meta">
                        {cell(<bdi>{job.location ?? "—"}</bdi>, "px-3 py-2.5")}
                      </td>
                      <td className="p-0">
                        {cell(
                          <StatusBadge status={job.status} size="sm" />,
                          "px-3 py-2.5",
                        )}
                      </td>
                      <td className="p-0 t-meta">
                        {cell(
                          formatDateValue(job.created_at, locale),
                          "px-3 py-2.5",
                        )}
                      </td>
                      <td className="p-0 text-sm tabular-nums text-ink-800">
                        {cell(counts.get(job.id) ?? 0, "px-5 py-2.5")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="t-meta mt-4 max-w-2xl">{t("ownershipNote")}</p>
    </>
  );
}
