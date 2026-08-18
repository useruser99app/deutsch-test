import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import { formatJsonValue, type Candidate, type ChangeItem } from "@/lib/domain";
import StatusBadge from "@/components/StatusBadge";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-end font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default async function CandidateDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { locale } = await params;
  const { submitted } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "candidate");

  const t = await getTranslations("candidate.dashboard");
  const tFields = await getTranslations("fields");
  const tEnums = await getTranslations("enums");
  const tCommon = await getTranslations("common");

  const { data: candidate } = await supabase
    .from("candidates")
    .select("*")
    .maybeSingle<Candidate>();

  if (!candidate) {
    return <p className="text-sm text-gray-600">{t("noProfile")}</p>;
  }

  const isApprenticeship = candidate.candidate_type === "apprenticeship_candidate";

  const [{ data: details }, { data: occupations }, { data: profile }, { data: changeItems }, { data: documents }] =
    await Promise.all([
      isApprenticeship
        ? supabase.from("apprenticeship_details").select("*").maybeSingle()
        : supabase.from("skilled_worker_details").select("*").maybeSingle(),
      supabase
        .from("candidate_target_occupations")
        .select("occupation, rank")
        .order("rank"),
      supabase
        .from("candidate_profiles")
        .select("profile_status, published_at")
        .maybeSingle(),
      supabase
        .from("candidate_change_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("candidate_documents")
        .select("*")
        .order("uploaded_at", { ascending: false }),
    ]);

  const boolLabel = (value: boolean | null) =>
    value === null || value === undefined
      ? "—"
      : value
        ? tCommon("yes")
        : tCommon("no");

  const pendingItems = (changeItems ?? []).filter(
    (item: ChangeItem) => item.status === "pending"
  );
  const reviewedItems = (changeItems ?? []).filter(
    (item: ChangeItem) => item.status !== "pending"
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-md bg-gray-900 px-3 py-1 font-mono text-white">
            {candidate.candidate_code}
          </span>
          {profile ? (
            <span className="flex items-center gap-2">
              {t("profileStatus")}: <StatusBadge status={profile.profile_status} />
            </span>
          ) : (
            <span className="text-gray-500">{t("noProfile")}</span>
          )}
        </div>
      </div>

      {submitted && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("submitted")}
        </p>
      )}

      <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
        {t("approvalNote")}
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("approvedData")}</h2>
        <div className="grid gap-x-10 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
          <dl>
            <Row
              label={tFields("candidate_type")}
              value={tEnums(`candidateType.${candidate.candidate_type}`)}
            />
            <Row label={tFields("first_name")} value={candidate.first_name} />
            <Row label={tFields("last_name")} value={candidate.last_name} />
            <Row label={tFields("email")} value={candidate.email} />
            <Row label={tFields("phone")} value={candidate.phone} />
            <Row
              label={tFields("nationality")}
              value={candidate.nationality}
            />
            <Row
              label={tFields("country_of_residence")}
              value={candidate.country_of_residence}
            />
          </dl>
          <dl>
            <Row
              label={tFields("german_level")}
              value={candidate.german_level}
            />
            <Row
              label={tFields("availability_date")}
              value={candidate.availability_date}
            />
            <Row
              label={tFields("drivers_license")}
              value={boolLabel(candidate.drivers_license)}
            />
            <Row
              label={tFields("relocation_ready")}
              value={boolLabel(candidate.relocation_ready)}
            />
            {isApprenticeship && (
              <Row
                label={tFields("target_occupations")}
                value={
                  (occupations ?? [])
                    .map((o: { occupation: string }) => o.occupation)
                    .join(", ") || "—"
                }
              />
            )}
            {isApprenticeship && details && (
              <>
                <Row
                  label={tFields("desired_training_start")}
                  value={details.desired_training_start}
                />
                <Row
                  label={tFields("preferred_locations")}
                  value={(details.preferred_locations ?? []).join(", ") || "—"}
                />
                <Row
                  label={tFields("motivation_summary")}
                  value={details.motivation_summary}
                />
              </>
            )}
            {!isApprenticeship && details && (
              <>
                <Row label={tFields("profession")} value={details.profession} />
                <Row
                  label={tFields("years_experience")}
                  value={details.years_experience}
                />
                <Row
                  label={tFields("preferred_locations")}
                  value={(details.preferred_locations ?? []).join(", ") || "—"}
                />
              </>
            )}
          </dl>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("pendingChanges")}</h2>
          <Link
            href="/candidate/changes"
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            {t("proposeChanges")}
          </Link>
        </div>
        {pendingItems.length === 0 && reviewedItems.length === 0 ? (
          <p className="text-sm text-gray-600">{t("noPendingChanges")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-start text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-start">{tFields("status")}</th>
                  <th className="px-3 py-2 text-start">
                    {t("currentLabel")} → {t("proposedLabel")}
                  </th>
                  <th className="px-3 py-2 text-start">{t("reviewComment")}</th>
                </tr>
              </thead>
              <tbody>
                {[...pendingItems, ...reviewedItems].map((item: ChangeItem) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 align-top">
                      <div className="mb-1 font-medium">
                        {tFields.has(item.field_key)
                          ? tFields(item.field_key)
                          : item.field_key}
                      </div>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="text-gray-500">
                        {formatJsonValue(item.current_value)}
                      </span>{" "}
                      → <span className="font-medium">{formatJsonValue(item.proposed_value)}</span>
                    </td>
                    <td className="px-3 py-2 align-top text-gray-600">
                      {item.review_comment ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("documents")}</h2>
          <Link
            href="/candidate/documents"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            {t("uploadDocument")}
          </Link>
        </div>
        {(documents ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">{t("noDocuments")}</p>
        ) : (
          <ul className="space-y-2">
            {(documents ?? []).map(
              (doc: {
                id: string;
                document_type: string;
                original_filename: string;
                verification_status: string;
              }) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {tEnums(`documentType.${doc.document_type}`)}
                    </span>{" "}
                    · {doc.original_filename}
                  </span>
                  <StatusBadge status={doc.verification_status} />
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
