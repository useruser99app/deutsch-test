import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
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
          <Link href="/employer/jobs" className="t-meta hover:text-accent hover:underline">
            {t("backToList")}
          </Link>
        }
      />
      <Panel>
        <JobForm />
      </Panel>
    </>
  );
}
