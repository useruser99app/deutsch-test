import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import CreateCandidateForm from "@/components/CreateCandidateForm";

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <CreateCandidateForm />

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
