import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadDecidedChanges, loadPendingChanges } from "@/lib/admin-data";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ValueComparison from "@/components/ui/ValueComparison";
import CandidateIdentity from "@/components/ui/CandidateIdentity";
import ReviewDecisionForm from "@/components/admin/ReviewDecisionForm";

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
    <>
      <PageHeader
        title={t("title")}
        description={
          pending.length > 0 ? t("queueCount", { count: pending.length }) : t("noPending")
        }
      />

      {/* Open work: each item is one decision, visually foregrounded. */}
      {pending.length === 0 ? (
        <EmptyState message={t("noPending")} />
      ) : (
        <ul className="space-y-4">
          {pending.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-hairline bg-surface shadow-panel"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4">
                <CandidateIdentity
                  candidate={item.candidates}
                  candidateId={item.candidate_id}
                  size="sm"
                />
                <span className="t-meta">
                  {t("submittedAt")}:{" "}
                  {(
                    item.candidate_change_sets?.submitted_at ?? item.created_at
                  ).slice(0, 10)}
                  {item.candidate_change_sets?.source
                    ? ` · ${t("source")}: ${item.candidate_change_sets.source}`
                    : ""}
                </span>
              </div>

              <div className="px-5 py-4">
                <p className="mb-3 flex flex-wrap items-baseline gap-2">
                  <span className="t-entity text-[15px]">
                    {tFields.has(item.field_key)
                      ? tFields(item.field_key)
                      : item.field_key}
                  </span>
                  {item.source_language && (
                    <span className="t-meta">
                      {t("sourceLanguage")}: {item.source_language}
                    </span>
                  )}
                </p>

                <ValueComparison
                  currentValue={item.current_value}
                  proposedValue={item.proposed_value}
                />

                <div className="mt-4">
                  <ReviewDecisionForm
                    kind="change"
                    id={item.id}
                    candidateId={item.candidate_id}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Decided history — same information, deliberately quieter. */}
      <div className="mt-8">
        <Panel title={t("historyTitle")} description={t("historyDescription")} bleed>
          {history.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noHistory")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {history.map((item) => (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CandidateIdentity
                      candidate={item.candidates}
                      candidateId={item.candidate_id}
                      size="sm"
                    />
                    <span className="flex items-center gap-3">
                      <span className="t-meta">
                        {t("reviewedAt")}: {item.reviewed_at?.slice(0, 10) ?? "—"}
                      </span>
                      <StatusBadge status={item.status} size="sm" />
                    </span>
                  </div>

                  <p className="mt-2.5 mb-2 text-sm font-semibold text-ink-800">
                    {tFields.has(item.field_key)
                      ? tFields(item.field_key)
                      : item.field_key}
                  </p>

                  <ValueComparison
                    currentValue={item.current_value}
                    proposedValue={item.proposed_value}
                    muted
                  />

                  {item.review_comment && (
                    <p className="t-body mt-3 rounded-md bg-ink-50 px-3 py-2">
                      <span className="font-medium">{t("comment")}: </span>
                      {item.review_comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
