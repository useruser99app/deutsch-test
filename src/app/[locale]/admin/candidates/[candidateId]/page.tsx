import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadCandidateSnapshot,
  loadChangeItems,
  loadDocuments,
} from "@/lib/candidate-data";
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
  const tFields = await getTranslations("fields");
  const tEnums = await getTranslations("enums");
  const tReview = await getTranslations("admin.review");
  const tDocs = await getTranslations("admin.documents");
  const tCandidates = await getTranslations("admin.candidates");
  const tCommon = await getTranslations("common");

  const snapshot = await loadCandidateSnapshot(supabase, candidateId);
  if (!snapshot) notFound();

  const { candidate, apprenticeship, skilled, isApprenticeship } = snapshot;
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
  const hasOpenWork = pending.length > 0 || pendingDocuments.length > 0;

  const notProvided = tCommon("notProvided");

  /** The facts a reviewer needs first, by candidate type (§8). */
  const keyFacts = isApprenticeship
    ? [
        {
          label: t("primaryTarget"),
          value: snapshot.occupations[0]?.occupation ?? notProvided,
          missing: !snapshot.occupations[0],
        },
        {
          label: tFields("german_level"),
          value: candidate.german_level,
          missing: false,
        },
        {
          label: tFields("desired_training_start"),
          value: apprenticeship?.desired_training_start ?? notProvided,
          missing: !apprenticeship?.desired_training_start,
        },
        {
          label: tFields("school_qualification"),
          value: apprenticeship?.school_qualification ?? notProvided,
          missing: !apprenticeship?.school_qualification,
        },
      ]
    : [
        {
          label: tFields("profession"),
          value: skilled?.profession ?? notProvided,
          missing: !skilled?.profession,
        },
        {
          label: tFields("german_level"),
          value: candidate.german_level,
          missing: false,
        },
        {
          label: tFields("years_experience"),
          value: skilled?.years_experience?.toString() ?? notProvided,
          missing: skilled?.years_experience === null || skilled?.years_experience === undefined,
        },
        {
          label: tFields("availability_date"),
          value: candidate.availability_date ?? notProvided,
          missing: !candidate.availability_date,
        },
      ];

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

      <section className="rounded-lg border border-hairline bg-surface shadow-panel">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4">
          <span className="t-meta font-mono">
            <bdi>{candidate.candidate_code}</bdi>
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${trackClass(
              candidate.candidate_type
            )}`}
          >
            {tEnums(`candidateType.${candidate.candidate_type}`)}
          </span>
          <span className="t-meta break-all">
            <bdi>{candidate.email}</bdi>
          </span>
        </div>

        {/* Professional facts first */}
        <dl className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {keyFacts.map((fact) => (
            <div key={fact.label}>
              <dt className="t-label">{fact.label}</dt>
              <dd
                className={`mt-1 font-semibold ${
                  fact.missing
                    ? "t-value t-empty"
                    : "text-base text-ink-900"
                }`}
              >
                <bdi>{fact.value}</bdi>
              </dd>
            </div>
          ))}
        </dl>

        {/* Lifecycle states, explicitly labelled */}
        <dl className="grid gap-x-8 gap-y-4 border-t border-hairline px-5 py-4 sm:grid-cols-3">
          <div>
            <dt className="t-label">{tFields("profile_status")}</dt>
            <dd className="mt-1.5">
              {snapshot.profile ? (
                <StatusBadge status={snapshot.profile.profile_status} />
              ) : (
                <span className="t-meta">{notProvided}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="t-label">{tCandidates("accountStatus")}</dt>
            <dd className="mt-1.5">
              {accountStatus ? (
                <StatusBadge status={accountStatus} />
              ) : (
                <span className="t-meta">{notProvided}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="t-label">{t("candidateStatus")}</dt>
            <dd className="mt-1.5">
              <StatusBadge status={candidate.status} />
            </dd>
          </div>
        </dl>

        {/* Open work — compact when there is none (§8) */}
        <div className="border-t border-hairline px-5 py-3">
          {hasOpenWork ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="t-label">{t("openWork")}</span>
              {pending.length > 0 && (
                <a
                  href="#pending-changes"
                  className="text-sm font-semibold text-attention hover:underline"
                >
                  {t("pendingChanges", { count: pending.length })}
                </a>
              )}
              {pendingDocuments.length > 0 && (
                <a
                  href="#documents"
                  className="text-sm font-semibold text-attention hover:underline"
                >
                  {t("pendingDocuments", { count: pendingDocuments.length })}
                </a>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ink-600">
              <StatusBadge status="approved" size="sm" />
              {t("noOpenReviews")}
            </p>
          )}
        </div>
      </section>

      {/* Whole private profile as one surface (§7) */}
      <div className="mt-6">
        <Panel title={t("profileTitle")} bleed>
          <ProfileFields snapshot={snapshot} columns={3} />
        </Panel>
      </div>

      {pending.length > 0 && (
        <div id="pending-changes" className="mt-6 scroll-mt-6">
          <Panel
            title={tReview("pendingTitle")}
            description={tReview("pendingDescription")}
          >
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
          </Panel>
        </div>
      )}

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

      <div className="mt-6">
        <Panel
          title={tReview("historyTitle")}
          description={tReview("historyDescription")}
          bleed
        >
          {history.length === 0 ? (
            <div className="p-5">
              <EmptyState message={tReview("noHistory")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {history.map((item) => (
                <li key={item.id} className="px-5 py-4">
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
