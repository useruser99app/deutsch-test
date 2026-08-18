import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createCompany } from "@/lib/actions/admin";
import CreateEmployerForm from "@/components/CreateEmployerForm";

interface CompanyRow {
  id: string;
  name: string;
  city: string | null;
  country: string;
  industry: string | null;
  status: string;
}

export default async function AdminCompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { created, error } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.companies");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, city, country, industry, status")
    .order("created_at", { ascending: false });

  const rows = (companies ?? []) as CompanyRow[];
  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2";
  const labelClass = "mb-1 block text-sm text-gray-700";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {created && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("created")}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("error")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          action={createCompany}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
        >
          <input type="hidden" name="locale" value={locale} />
          <h2 className="text-lg font-semibold">{t("create")}</h2>
          <div>
            <label className={labelClass} htmlFor="name">
              {t("name")}
            </label>
            <input
              id="name"
              type="text"
              name="name"
              required
              className={inputClass}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="website">
                {t("website")}
              </label>
              <input
                id="website"
                type="text"
                name="website"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="industry">
                {t("industry")}
              </label>
              <input
                id="industry"
                type="text"
                name="industry"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="country">
                {t("country")}
              </label>
              <input
                id="country"
                type="text"
                name="country"
                defaultValue="DE"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="city">
                {t("city")}
              </label>
              <input id="city" type="text" name="city" className={inputClass} />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
          >
            {t("submit")}
          </button>
        </form>

        <CreateEmployerForm
          companies={rows.map((company) => ({
            id: company.id,
            name: company.name,
          }))}
        />
      </div>

      <section>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-600">{t("noCompanies")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-start">{t("name")}</th>
                  <th className="px-3 py-2 text-start">{t("city")}</th>
                  <th className="px-3 py-2 text-start">{t("country")}</th>
                  <th className="px-3 py-2 text-start">{t("industry")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((company) => (
                  <tr key={company.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium">{company.name}</td>
                    <td className="px-3 py-2">{company.city ?? "—"}</td>
                    <td className="px-3 py-2">{company.country}</td>
                    <td className="px-3 py-2">{company.industry ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
