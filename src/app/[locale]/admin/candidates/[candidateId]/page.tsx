import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
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
import ValueCompare from "@/components/admin/ValueCompare";
import ReviewDecisionForm from "@/components/admin/ReviewDecisionForm";

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
  const isApprenticeship = snapshot.isApprenticeship;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/candidates"
        className="inline-block text-sm text-blue-700 underline"
      >
        {t("backToList")}
      </Link>

      {/* Header */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-semibold text-gray-900">
              {candidate.candidate_code}
            </p>
            <p className="mt-0.5 text-xl font-semibold text-gray-900">
              {candidate.first_name} {candidate.last_name}
            </p>
            <p className="mt-0.5 break-all text-sm text-gray-600">
              {candidate.email}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              isApprenticeship
                ? "bg-indigo-100 text-indigo-800"
                : "bg-teal-100 text-teal-800"
            }`}
          >
            {tEnums(`candidateType.${candidate.candidate_type}`)}
          </span>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {tFields("german_level")}
            </dt>
            <dd className="font-medium text-gray-900">
              {candidate.german_level}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {tFields("profile_status")}
            </dt>
            <dd className="mt-0.5">
              {snapshot.profile ? (
                <StatusBadge status={snapshot.profile.profile_status} />
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {tCandidates("accountStatus")}
            </dt>
            <dd className="mt-0.5">
              {accountStatus ? (
                <StatusBadge status={accountStatus} />
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {tFields("status")}
            </dt>
            <dd className="mt-0.5">
              <StatusBadge status={candidate.status} />
            </dd>
          </div>
        </dl>

        {/* Open work for this candidate, with direct jumps (§8). */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm">
          <span className="font-medium text-gray-900">{t("openWork")}:</span>
          <a
            href="#pending-changes"
            className={
              pending.length > 0
                ? "font-medium text-amber-800 underline"
                : "text-gray-600"
            }
          >
            {t("pendingChanges", { count: pending.length })}
          </a>
          <a
            href="#documents"
            className={
              pendingDocuments.length > 0
                ? "font-medium text-amber-800 underline"
                : "text-gray-600"
            }
          >
            {t("pendingDocuments", { count: pendingDocuments.length })}
          </a>
        </div>
      </section>

      {/* Private candidate profile — admin view (§7) */}
      {fieldSections.map((section) => {
        const fields = fieldsForSection(candidate.candidate_type, section);
        if (fields.length === 0) return null;

        return (
          <SectionCard key={section} title={tSections(section)}>
            {section === "occupation" &&
              isApprenticeship &&
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

      {/* Pending changes with inline decisions */}
      <div id="pending-changes" className="scroll-mt-24">
        <SectionCard
          title={tReview("pendingTitle")}
          description={tReview("pendingDescription")}
        >
          {pending.length === 0 ? (
            <p className="py-2 text-sm text-gray-600">{tReview("noPending")}</p>
          ) : (
            <ul className="space-y-4 py-1">
              {pending.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {tFields.has(item.field_key)
                        ? tFields(item.field_key)
                        : item.field_key}
                    </span>
                    <span className="text-xs text-gray-500">
                      {tReview("submittedAt")}: {item.created_at.slice(0, 10)}
                      {item.source_language
                        ? ` · ${tReview("sourceLanguage")}: ${item.source_language}`
                        : ""}
                    </span>
                  </div>
                  <ValueCompare
                    currentValue={item.current_value}
                    proposedValue={item.proposed_value}
                  />
                  <div className="mt-3">
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
        </SectionCard>
      </div>

      {/* Documents */}
      <div id="documents" className="scroll-mt-24">
        <SectionCard title={tDocs("title")}>
          {documents.length === 0 ? (
            <p className="py-2 text-sm text-gray-600">{tDocs("noDocuments")}</p>
          ) : (
            <ul className="space-y-4 py-1">
              {documents.map((doc) => {
                const replaced = doc.replaces_document_id
                  ? documentsById.get(doc.replaces_document_id)
                  : null;
                const isPending =
                  doc.verification_status === "pending_review";

                return (
                  <li
                    key={doc.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {tEnums(`documentType.${doc.document_type}`)}
                        </p>
                        <p className="mt-0.5 break-all text-xs text-gray-500">
                          {doc.original_filename}
                        </p>
                      </div>
                      <StatusBadge status={doc.verification_status} />
                    </div>

                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                      <div className="flex gap-1">
                        <dt>{tDocs("uploadedAt")}:</dt>
                        <dd>{doc.uploaded_at.slice(0, 10)}</dd>
                      </div>
                      {doc.reviewed_at && (
                        <div className="flex gap-1">
                          <dt>{tDocs("reviewedAt")}:</dt>
                          <dd>{doc.reviewed_at.slice(0, 10)}</dd>
                        </div>
                      )}
                      {replaced && (
                        <div className="flex gap-1">
                          <dt>{tDocs("replaces")}:</dt>
                          <dd className="break-all">
                            {replaced.original_filename}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {doc.review_note && (
                      <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <span className="font-medium">
                          {tDocs("reviewNote")}:{" "}
                        </span>
                        {doc.review_note}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <a
                        href={`/api/documents/view?id=${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-700 underline"
                      >
                        {tDocs("view")}
                      </a>
                    </div>

                    {isPending && (
                      <div className="mt-3">
                        <ReviewDecisionForm
                          kind="document"
                          id={doc.id}
                          candidateId={candidateId}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Decided history for this candidate */}
      <SectionCard
        title={tReview("historyTitle")}
        description={tReview("historyDescription")}
      >
        {history.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{tReview("noHistory")}</p>
        ) : (
          <ul className="space-y-3 py-1">
            {history.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {tFields.has(item.field_key)
                      ? tFields(item.field_key)
                      : item.field_key}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-2">
                  <ValueCompare
                    currentValue={item.current_value}
                    proposedValue={item.proposed_value}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {tReview("reviewedAt")}:{" "}
                  {item.reviewed_at?.slice(0, 10) ?? "—"}
                  {item.reviewed_by ? ` · ${tReview("reviewer")}` : ""}
                </p>
                {item.review_comment && (
                  <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-medium">{tReview("comment")}: </span>
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
