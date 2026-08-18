import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";

export default async function EmployerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "employer");
  const t = await getTranslations("employer");

  const { data: companies } = await supabase
    .from("companies")
    .select("name, city, country");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-gray-700">{t("welcome")}</p>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">{t("company")}</h2>
        {(companies ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">{t("noCompany")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(companies ?? []).map(
              (company: { name: string; city: string | null; country: string }) => (
                <li key={company.name}>
                  <span className="font-medium">{company.name}</span>
                  {company.city ? ` · ${company.city}` : ""} · {company.country}
                </li>
              )
            )}
          </ul>
        )}
      </section>

      <p className="text-sm text-gray-500">{t("comingSoon")}</p>
    </div>
  );
}
