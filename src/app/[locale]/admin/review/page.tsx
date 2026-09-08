import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadDecidedChanges, loadPendingChanges } from "@/lib/admin-data";
import StatusBadge from "@/components/StatusBadge";
import SectionCard from "@/components/candidate/SectionCard";
import ValueCompare from "@/components/admin/ValueCompare";
import ReviewDecisionForm from "@/components/admin/ReviewDecisionForm";
import CandidateRef from "@/components/admin/CandidateRef";

export default async function AdminReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.review");
  const tFields = await getTranslations("fields");

  const [pending, history] = await Promise.all([
    loadPendingChanges(supabase),
    loadDecidedChanges(supabase),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {pending.length > 0
            ? t("queueCount", { count: pending.length })
            : t("noPending")}
        </p>
      </header>

      <SectionCard
        title={t("pendingTitle")}
        description={t("pendingDescription")}
      >
        {pending.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("noPending")}</p>
        ) : (
          <ul className="space-y-4 py-1">
            {pending.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <CandidateRef
                    candidate={item.candidates}
                    candidateId={item.candidate_id}
                  />
                  <span className="text-xs text-gray-500">
                    {t("submittedAt")}:{" "}
                    {(
                      item.candidate_change_sets?.submitted_at ??
                      item.created_at
                    ).slice(0, 10)}
                    {item.candidate_change_sets?.source
                      ? ` · ${t("source")}: ${item.candidate_change_sets.source}`
                      : ""}
                  </span>
                </div>

                <p className="mb-2 text-sm font-semibold text-gray-900">
                  {tFields.has(item.field_key)
                    ? tFields(item.field_key)
                    : item.field_key}
                  {item.source_language && (
                    <span className="ms-2 text-xs font-normal text-gray-500">
                      {t("sourceLanguage")}: {item.source_language}
                    </span>
                  )}
                </p>

                <ValueCompare
                  currentValue={item.current_value}
                  proposedValue={item.proposed_value}
                />

                <div className="mt-3">
                  <ReviewDecisionForm
                    kind="change"
                    id={item.id}
                    candidateId={item.candidate_id}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={t("historyTitle")}
        description={t("historyDescription")}
      >
        {history.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("noHistory")}</p>
        ) : (
          <ul className="space-y-3 py-1">
            {history.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CandidateRef
                    candidate={item.candidates}
                    candidateId={item.candidate_id}
                  />
                  <StatusBadge status={item.status} />
                </div>

                <p className="mt-2 mb-2 text-sm font-semibold text-gray-900">
                  {tFields.has(item.field_key)
                    ? tFields(item.field_key)
                    : item.field_key}
                </p>

                <ValueCompare
                  currentValue={item.current_value}
                  proposedValue={item.proposed_value}
                />

                <p className="mt-2 text-xs text-gray-500">
                  {t("reviewedAt")}: {item.reviewed_at?.slice(0, 10) ?? "—"}
                  {item.candidate_change_sets?.source
                    ? ` · ${t("source")}: ${item.candidate_change_sets.source}`
                    : ""}
                </p>

                {item.review_comment && (
                  <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-medium">{t("comment")}: </span>
                    {item.review_comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
