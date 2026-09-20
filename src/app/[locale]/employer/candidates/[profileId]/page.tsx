import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadActiveRequest,
  loadCompanyJobs,
  loadEmployerCandidate,
  loadPublicNarrative,
} from "@/lib/employer-data";
import { loadJob } from "@/lib/jobs-data";
import { evaluateCandidateForJob } from "@/lib/matching";
import CandidatePreview from "@/components/marketplace/CandidatePreview";

/**
 * The addressable profile of one published candidate.
 *
 * Deliberately a thin container around `CandidatePreview`: the marketplace
 * preview and this route must show the same profile, and the reliable way
 * to guarantee that is to render the same component rather than to keep two
 * layouts in step by hand. This route stays because it is linked from a
 * vacancy and from the requests list, and because it is what a narrow
 * screen navigates to.
 */
export default async function EmployerCandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; profileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, profileId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");
  const sp = await searchParams;
  // Set when the employer came here from one of their vacancies.
  const fromJob = (Array.isArray(sp.job) ? sp.job[0] : sp.job)?.trim();

  // Returns null for anything not published — an unpublished candidate is a
  // 404 for employers, not a hidden page.
  const candidate = await loadEmployerCandidate(supabase, profileId);
  if (!candidate) notFound();

  const [narrative, activeRequest, jobs, job] = await Promise.all([
    loadPublicNarrative(supabase, profileId, locale),
    loadActiveRequest(supabase, profileId),
    loadCompanyJobs(supabase),
    fromJob ? loadJob(supabase, fromJob) : Promise.resolve(null),
  ]);

  const tDetail = await getTranslations("employer.candidate");

  // Same evaluation as everywhere else, and only when a vacancy is actually
  // in context. Nothing is computed or shown without one.
  const fit = job ? evaluateCandidateForJob(job, candidate) : undefined;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/employer/candidates"
          className="t-meta inline-flex items-center gap-1 hover:text-accent hover:underline"
        >
          <span aria-hidden className="rtl:rotate-180">
            &#8592;
          </span>
          {tDetail("backToList")}
        </Link>
      </div>

      <CandidatePreview
        candidate={candidate}
        narrative={narrative}
        activeRequest={activeRequest}
        jobs={jobs}
        locale={locale}
        fit={fit?.eligible ? fit : undefined}
        jobTitle={job?.title}
        preselectedJobId={fromJob}
        variant="page"
      />
    </>
  );
}
