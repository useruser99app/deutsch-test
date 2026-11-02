import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import JobForm from "@/components/employer/JobForm";

export default async function NewJobPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "employer");
  const t = await getTranslations("employer.jobs");

  return (
    <>
      <PageHeader
        title={t("createTitle")}
        description={t("createDescription")}
        breadcrumb={
          <Link
            href="/employer/jobs"
            className="t-meta inline-flex items-center gap-1 hover:text-accent hover:underline"
          >
            <span aria-hidden className="rtl:rotate-180">
              &#8592;
            </span>
            {t("backToList")}
          </Link>
        }
      />
      {/* The same Design System 2.0 surface as the vacancy pages. */}
      <section className="max-w-4xl rounded-card border border-hairline-strong bg-surface px-5 py-5 shadow-card">
        <JobForm />
      </section>
    </>
  );
}
