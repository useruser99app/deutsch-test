import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { createCompany } from "@/lib/actions/admin";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { buttonClass, controlClass } from "@/components/ui/button";
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
    .order("name");

  const rows = (companies ?? []) as CompanyRow[];
  const labelClass = "t-label mb-1.5 block";

  return (
    <>
      <PageHeader title={t("title")} />

      {created && (
        <p
          role="status"
          className="mb-4 rounded-md border border-positive/25 bg-positive-soft px-4 py-2.5 text-sm text-positive"
        >
          {t("created")}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-critical/25 bg-critical-soft px-4 py-2.5 text-sm text-critical"
        >
          {t("error")}
        </p>
      )}

      <Panel bleed>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState message={t("noCompanies")} compact />
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((company) => (
              <li key={company.id}>
                {/* The whole row is the link — not a small text target. */}
                <Link
                  href={`/admin/companies/${company.id}`}
                  className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <p className="t-entity text-[15px] group-hover:text-accent">
                      <bdi>{company.name}</bdi>
                    </p>
                    <p className="t-meta mt-0.5">
                      {[company.city, company.country, company.industry]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <StatusBadge status={company.status} size="sm" />
                  <span
                    aria-hidden
                    className="shrink-0 text-ink-300 transition-colors group-hover:text-accent rtl:rotate-180"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={t("create")}>
          <form action={createCompany} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <div>
              <label className={labelClass} htmlFor="name">
                {t("name")}
              </label>
              <input
                id="name"
                type="text"
                name="name"
                required
                className={controlClass}
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
                  className={controlClass}
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
                  className={controlClass}
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
                  className={controlClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="city">
                  {t("city")}
                </label>
                <input
                  id="city"
                  type="text"
                  name="city"
                  className={controlClass}
                />
              </div>
            </div>
            <button type="submit" className={buttonClass("primary", "md")}>
              {t("submit")}
            </button>
          </form>
        </Panel>

        <Panel>
          <CreateEmployerForm
            companies={rows.map((company) => ({
              id: company.id,
              name: company.name,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
