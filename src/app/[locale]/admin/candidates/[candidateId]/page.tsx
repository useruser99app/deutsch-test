import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadCandidateSnapshot,
  loadChangeItems,
  loadDocuments,
} from "@/lib/candidate-data";
import { fieldSections, fieldsForSection } from "@/lib/candidate-fields";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ValueComparison from "@/components/ui/ValueComparison";
import { trackClass } from "@/components/ui/CandidateIdentity";
import ProfileFields from "@/components/candidate/ProfileFields";
import ReviewDecisionForm from "@/components/admin/ReviewDecisionForm";
import DocumentRow from "@/components/admin/DocumentRow";

export default async function AdminCandidateDetailPage({
  params,
}: {
  params: Promise<{ locale: string; candidateId: string }>;
}) {
  const { locale, candidateId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.candidateDetail");
  const tSections = await getTranslations("candidate.sections");
  const tFields = await getTranslations("fields");
  const tEnums = await getTranslations("enums");
  const tReview = await getTranslations("admin.review");
  const tDocs = await getTranslations("admin.documents");
  const tCandidates = await getTranslations("admin.candidates");

  const snapshot = await loadCandidateSnapshot(supabase, candidateId);
  if (!snapshot) notFound();

  const { candidate } = snapshot;
  const [{ pending, history }, documents, accountResult] = await Promise.all([
    loadChangeItems(supabase, { candidateId }),
    loadDocuments(supabase, candidateId),
    candidate.user_id
      ? supabase
          .from("app_users")
          .select("account_status")
          .eq("id", candidate.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const accountStatus =
    (accountResult.data as { account_status: string } | null)?.account_status ??
    null;
  const pendingDocuments = documents.filter(
    (doc) => doc.verification_status === "pending_review"
  );
  const documentsById = new Map(documents.map((doc) => [doc.id, doc]));

  return (
    <>
      <PageHeader
        title={`${candidate.first_name} ${candidate.last_name}`}
        breadcrumb={
          <Link
            href="/admin/candidates"
            className="t-meta hover:text-accent hover:underline"
          >
            {t("backToList")}
          </Link>
        }
      />

      {/* Identity and state at a glance */}
      <section className="rounded-lg border border-hairline bg-surface p-5 shadow-panel">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-sm font-medium text-ink-600">
            {candidate.candidate_code}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${trackClass(
              candidate.candidate_type
            )}`}
          >
            {tEnums(`candidateType.${candidate.candidate_type}`)}
          </span>
          <span className="t-meta break-all">{candidate.email}</span>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="t-label">{tFields("german_level")}</dt>
            <dd className="mt-1 text-lg font-semibold text-ink-900">
              {candidate.german_level}
            </dd>
          </div>
          <div>
            <dt className="t-label">{tFields("profile_status")}</dt>
            <dd className="mt-1.5">
              {snapshot.profile ? (
                <StatusBadge status={snapshot.profile.profile_status} />
              ) : (
                <span className="t-meta">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="t-label">{tCandidates("accountStatus")}</dt>
            <dd className="mt-1.5">
              {accountStatus ? (
                <StatusBadge status={accountStatus} />
              ) : (
                <span className="t-meta">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="t-label">{tFields("status")}</dt>
            <dd className="mt-1.5">
              <StatusBadge status={candidate.status} />
            </dd>
          </div>
        </dl>

        {/* Open work with direct jumps (§8) */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-4">
          <span className="t-label">{t("openWork")}</span>
          <a
            href="#pending-changes"
            className={
              pending.length > 0
                ? "text-sm font-semibold text-attention hover:underline"
                : "t-meta"
            }
          >
            {t("pendingChanges", { count: pending.length })}
          </a>
          <a
            href="#documents"
            className={
              pendingDocuments.length > 0
                ? "text-sm font-semibold text-attention hover:underline"
                : "t-meta"
            }
          >
            {t("pendingDocuments", { count: pendingDocuments.length })}
          </a>
        </div>
      </section>

      {/* Private profile — admin view (§7) */}
      <div className="mt-6 space-y-6">
        {fieldSections.map((section) => {
          if (fieldsForSection(candidate.candidate_type, section).length === 0) {
            return null;
          }
          return (
            <Panel key={section} title={tSections(section)}>
              <ProfileFields snapshot={snapshot} section={section} />
            </Panel>
          );
        })}
      </div>

      {/* Pending changes — the actionable part of this page */}
      <div id="pending-changes" className="mt-6 scroll-mt-6">
        <Panel
          title={tReview("pendingTitle")}
          description={tReview("pendingDescription")}
        >
          {pending.length === 0 ? (
            <EmptyState message={tReview("noPending")} compact />
          ) : (
            <ul className="space-y-4">
              {pending.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-attention/30 bg-attention-soft/40 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="t-entity text-[15px]">
                      {tFields.has(item.field_key)
                        ? tFields(item.field_key)
                        : item.field_key}
                    </span>
                    <span className="t-meta">
                      {tReview("submittedAt")}: {item.created_at.slice(0, 10)}
                      {item.source_language
                        ? ` · ${tReview("sourceLanguage")}: ${item.source_language}`
                        : ""}
                    </span>
                  </div>
                  <ValueComparison
                    currentValue={item.current_value}
                    proposedValue={item.proposed_value}
                  />
                  <div className="mt-4">
                    <ReviewDecisionForm
                      kind="change"
                      id={item.id}
                      candidateId={candidateId}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Documents */}
      <div id="documents" className="mt-6 scroll-mt-6">
        <Panel title={tDocs("title")} bleed>
          {documents.length === 0 ? (
            <div className="p-5">
              <EmptyState message={tDocs("noDocuments")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  replacedFilename={
                    doc.replaces_document_id
                      ? documentsById.get(doc.replaces_document_id)
                          ?.original_filename
                      : undefined
                  }
                  candidateId={candidateId}
                  actionable={doc.verification_status === "pending_review"}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Decided history — deliberately quieter than open work */}
      <div className="mt-6">
        <Panel
          title={tReview("historyTitle")}
          description={tReview("historyDescription")}
        >
          {history.length === 0 ? (
            <EmptyState message={tReview("noHistory")} compact />
          ) : (
            <ul className="space-y-4">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-hairline p-4"
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-800">
                      {tFields.has(item.field_key)
                        ? tFields(item.field_key)
                        : item.field_key}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="t-meta">
                        {tReview("reviewedAt")}:{" "}
                        {item.reviewed_at?.slice(0, 10) ?? "—"}
                      </span>
                      <StatusBadge status={item.status} size="sm" />
                    </span>
                  </div>
                  <ValueComparison
                    currentValue={item.current_value}
                    proposedValue={item.proposed_value}
                    muted
                  />
                  {item.review_comment && (
                    <p className="t-body mt-3 rounded-md bg-ink-50 px-3 py-2">
                      <span className="font-medium">{tReview("comment")}: </span>
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
