import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  approvedValue,
  loadCandidateSnapshot,
  loadChangeItems,
  loadDocuments,
} from "@/lib/candidate-data";
import { fieldSections, fieldsForSection } from "@/lib/candidate-fields";
import StatusBadge from "@/components/StatusBadge";
import SectionCard from "@/components/candidate/SectionCard";
import FieldValue from "@/components/candidate/FieldValue";
import ChangeItemRow from "@/components/candidate/ChangeItemRow";

export default async function CandidateDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, profile } = await requireRole(locale, "candidate");

  const t = await getTranslations("candidate.dashboard");
  const tSections = await getTranslations("candidate.sections");
  const tFields = await getTranslations("fields");
  const tEnums = await getTranslations("enums");
  const tReviews = await getTranslations("candidate.reviews");
  const tDocs = await getTranslations("candidate.documents");

  const snapshot = await loadCandidateSnapshot(supabase);
  if (!snapshot) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        {t("noRecord")}
      </p>
    );
  }

  const [{ pending, history }, documents] = await Promise.all([
    loadChangeItems(supabase),
    loadDocuments(supabase),
  ]);

  const { candidate } = snapshot;
  const pendingByField = new Map(
    pending.map((item) => [item.field_key, item.proposed_value])
  );
  const pendingDocuments = documents.filter(
    (doc) => doc.verification_status === "pending_review"
  );

  // The single most useful next step, rather than a wall of statistics.
  const hint =
    pending.length > 0
      ? t("hintPendingChanges", { count: pending.length })
      : pendingDocuments.length > 0
        ? t("hintPendingDocuments", { count: pendingDocuments.length })
        : documents.length === 0
          ? t("hintNoDocuments")
          : t("hintAllClear");

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <p className="text-sm text-gray-500">
          {t("greeting", { name: candidate.first_name })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {tFields("candidate_code")}
            </p>
            <p className="font-mono text-lg font-semibold text-gray-900">
              {candidate.candidate_code}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {tFields("candidate_type")}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {tEnums(`candidateType.${candidate.candidate_type}`)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {tFields("german_level")}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {candidate.german_level}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {tFields("profile_status")}
            </p>
            <p className="mt-0.5">
              {snapshot.profile ? (
                <StatusBadge status={snapshot.profile.profile_status} />
              ) : (
                <span className="text-sm text-gray-500">{t("noProfile")}</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t("accountStatus")}
            </p>
            <p className="mt-0.5">
              <StatusBadge status={profile.account_status} />
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {hint}
        </p>
        <p className="mt-2 text-xs text-gray-500">{t("approvalNote")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/candidate/changes"
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            {t("proposeChanges")}
          </Link>
          <Link
            href="/candidate/documents"
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("uploadDocument")}
          </Link>
        </div>
      </section>

      {/* Approved data, grouped by section */}
      {fieldSections.map((section) => {
        const fields = fieldsForSection(candidate.candidate_type, section);
        if (fields.length === 0) return null;

        return (
          <SectionCard key={section} title={tSections(section)}>
            {section === "occupation" &&
              snapshot.isApprenticeship &&
              snapshot.occupations.length > 0 && (
                <div className="border-b border-gray-100 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {tFields("target_occupations")}
                  </dt>
                  <dd className="mt-1">
                    <ol className="space-y-1">
                      {snapshot.occupations.map((entry) => (
                        <li
                          key={entry.occupation}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                            {entry.rank}
                          </span>
                          <span className="font-medium text-gray-900">
                            {entry.occupation}
                          </span>
                          {entry.rank === 1 && (
                            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                              {t("primaryOccupation")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </dd>
                </div>
              )}

            <dl>
              {fields.map((field) => {
                // The ranked list above already renders this field.
                if (
                  field.key === "target_occupations" &&
                  snapshot.occupations.length > 0
                ) {
                  return null;
                }
                return (
                  <FieldValue
                    key={field.key}
                    label={
                      tFields.has(field.key) ? tFields(field.key) : field.key
                    }
                    value={approvedValue(snapshot, field.key)}
                    input={field.input}
                    hasPending={pendingByField.has(field.key)}
                    pendingValue={pendingByField.get(field.key)}
                  />
                );
              })}
              {section === "profile" && (
                <FieldValue label={tFields("email")} value={candidate.email} />
              )}
            </dl>
          </SectionCard>
        );
      })}

      {/* Documents */}
      <SectionCard
        title={tDocs("title")}
        action={
          <Link
            href="/candidate/documents"
            className="text-sm font-medium text-blue-700 underline"
          >
            {t("openSection")}
          </Link>
        }
      >
        {documents.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("noDocuments")}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.slice(0, 5).map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium text-gray-900">
                    {tEnums(`documentType.${doc.document_type}`)}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {doc.original_filename}
                  </span>
                </span>
                <StatusBadge status={doc.verification_status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Open proposals */}
      <SectionCard
        title={tReviews("pendingTitle")}
        action={
          <Link
            href="/candidate/reviews"
            className="text-sm font-medium text-blue-700 underline"
          >
            {t("openSection")}
          </Link>
        }
      >
        {pending.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("noPendingChanges")}</p>
        ) : (
          <ul className="space-y-3 py-1">
            {pending.slice(0, 3).map((item) => (
              <ChangeItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Review history */}
      <SectionCard
        title={tReviews("historyTitle")}
        action={
          <Link
            href="/candidate/reviews"
            className="text-sm font-medium text-blue-700 underline"
          >
            {t("openSection")}
          </Link>
        }
      >
        {history.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{tReviews("noHistory")}</p>
        ) : (
          <ul className="space-y-3 py-1">
            {history.slice(0, 3).map((item) => (
              <ChangeItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
