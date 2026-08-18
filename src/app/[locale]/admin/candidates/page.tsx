import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createCandidateAccount } from "@/lib/actions/admin";
import { candidateTypes, localeCodes } from "@/lib/domain";
import StatusBadge from "@/components/StatusBadge";

interface CandidateRow {
  id: string;
  candidate_code: string;
  candidate_type: string;
  first_name: string;
  last_name: string;
  email: string;
  german_level: string;
  status: string;
  app_users: { account_status: string } | null;
}

export default async function AdminCandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    created?: string;
    invite_link?: string;
    error?: string;
  }>;
}) {
  const { locale } = await params;
  const { created, invite_link: inviteLink, error } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.candidates");
  const tEnums = await getTranslations("enums");

  const { data: candidates } = await supabase
    .from("candidates")
    .select(
      "id, candidate_code, candidate_type, first_name, last_name, email, german_level, status, app_users ( account_status )"
    )
    .order("created_at", { ascending: false });

  const rows = (candidates ?? []) as unknown as CandidateRow[];
  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2";
  const labelClass = "mb-1 block text-sm text-gray-700";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {created && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          <p>
            {t("created")} ({created})
          </p>
          {inviteLink && (
            <div className="mt-2">
              <p className="font-medium">{t("inviteLinkLabel")}</p>
              <code className="mt-1 block break-all rounded bg-white p-2 text-xs">
                {inviteLink}
              </code>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("error")}
        </p>
      )}

      <form
        action={createCandidateAccount}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      >
        <input type="hidden" name="locale" value={locale} />
        <h2 className="text-lg font-semibold">{t("create")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="email">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="candidate_type">
              {t("candidateType")}
            </label>
            <select
              id="candidate_type"
              name="candidate_type"
              className={inputClass}
            >
              {candidateTypes.map((type) => (
                <option key={type} value={type}>
                  {tEnums(`candidateType.${type}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="first_name">
              {t("firstName")}
            </label>
            <input
              id="first_name"
              type="text"
              name="first_name"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="last_name">
              {t("lastName")}
            </label>
            <input
              id="last_name"
              type="text"
              name="last_name"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="preferred_locale">
              {t("locale")}
            </label>
            <select
              id="preferred_locale"
              name="preferred_locale"
              defaultValue="fr"
              className={inputClass}
            >
              {localeCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="invite_mode">
              {t("inviteMode")}
            </label>
            <select id="invite_mode" name="invite_mode" className={inputClass}>
              <option value="email">{t("inviteEmail")}</option>
              <option value="link">{t("inviteLink")}</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          {t("submit")}
        </button>
      </form>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("list")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-600">{t("noCandidates")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-start">{t("code")}</th>
                  <th className="px-3 py-2 text-start">{t("name")}</th>
                  <th className="px-3 py-2 text-start">{t("email")}</th>
                  <th className="px-3 py-2 text-start">{t("type")}</th>
                  <th className="px-3 py-2 text-start">{t("germanLevel")}</th>
                  <th className="px-3 py-2 text-start">{t("accountStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono">{row.candidate_code}</td>
                    <td className="px-3 py-2">
                      {row.first_name} {row.last_name}
                    </td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">
                      {tEnums(`candidateType.${row.candidate_type}`)}
                    </td>
                    <td className="px-3 py-2">{row.german_level}</td>
                    <td className="px-3 py-2">
                      {row.app_users ? (
                        <StatusBadge status={row.app_users.account_status} />
                      ) : (
                        "—"
                      )}
                    </td>
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
