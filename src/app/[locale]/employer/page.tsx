import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";

export default async function EmployerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");
  const t = await getTranslations("employer");
  const tMarketplace = await getTranslations("employer.marketplace");

  const { data: companies } = await supabase
    .from("companies")
    .select("name, city, country");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("welcome")}
        actions={
          <Link
            href="/employer/candidates"
            className={buttonClass("primary", "sm")}
          >
            {tMarketplace("title")}
          </Link>
        }
      />

      <Panel title={t("company")}>
        {(companies ?? []).length === 0 ? (
          <EmptyState message={t("noCompany")} compact />
        ) : (
          <ul className="space-y-1 text-sm">
            {(companies ?? []).map(
              (company: { name: string; city: string | null; country: string }) => (
                <li key={company.name} className="t-value">
                  <span className="font-semibold text-ink-900">
                    {company.name}
                  </span>
                  {company.city ? ` · ${company.city}` : ""} · {company.country}
                </li>
              )
            )}
          </ul>
        )}
      </Panel>

    </>
  );
}
