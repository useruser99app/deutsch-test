import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import {
  loadDecidedDocuments,
  loadPendingDocuments,
  type DocumentWithCandidate,
} from "@/lib/admin-data";
import StatusBadge from "@/components/StatusBadge";
import SectionCard from "@/components/candidate/SectionCard";
import ReviewDecisionForm from "@/components/admin/ReviewDecisionForm";
import CandidateRef from "@/components/admin/CandidateRef";

export default async function AdminDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.documents");
  const tEnums = await getTranslations("enums");

  const [pending, history] = await Promise.all([
    loadPendingDocuments(supabase),
    loadDecidedDocuments(supabase),
  ]);

  // Filenames of replaced predecessors, for the supersede relation (§14).
  const replacedIds = [...pending, ...history]
    .map((doc) => doc.replaces_document_id)
    .filter((id): id is string => Boolean(id));
  const { data: replacedRows } =
    replacedIds.length > 0
      ? await supabase
          .from("candidate_documents")
          .select("id, original_filename, verification_status")
          .in("id", replacedIds)
      : { data: [] };
  const replacedById = new Map(
    ((replacedRows ?? []) as {
      id: string;
      original_filename: string;
      verification_status: string;
    }[]).map((row) => [row.id, row])
  );

  function renderMeta(doc: DocumentWithCandidate) {
    const replaced = doc.replaces_document_id
      ? replacedById.get(doc.replaces_document_id)
      : null;

    return (
      <>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <div className="flex gap-1">
            <dt>{t("uploadedAt")}:</dt>
            <dd>{doc.uploaded_at.slice(0, 10)}</dd>
          </div>
          {doc.reviewed_at && (
            <div className="flex gap-1">
              <dt>{t("reviewedAt")}:</dt>
              <dd>{doc.reviewed_at.slice(0, 10)}</dd>
            </div>
          )}
          {replaced && (
            <div className="flex gap-1">
              <dt>{t("replaces")}:</dt>
              <dd className="break-all">{replaced.original_filename}</dd>
            </div>
          )}
        </dl>
        {replaced && doc.verification_status === "pending_review" && (
          <p className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">
            {t("supersedeHint")}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {pending.length > 0
            ? t("queueCount", { count: pending.length })
            : t("empty")}
        </p>
      </header>

      <SectionCard title={t("pendingTitle")} description={t("pendingDescription")}>
        {pending.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("empty")}</p>
        ) : (
          <ul className="space-y-4 py-1">
            {pending.map((doc) => (
              <li
                key={doc.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CandidateRef
                    candidate={doc.candidates}
                    candidateId={doc.candidate_id}
                  />
                  <StatusBadge status={doc.verification_status} />
                </div>

                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {tEnums(`documentType.${doc.document_type}`)}
                </p>
                <p className="mt-0.5 break-all text-xs text-gray-500">
                  {doc.original_filename}
                </p>

                {renderMeta(doc)}

                <a
                  href={`/api/documents/view?id=${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-blue-700 underline"
                >
                  {t("view")}
                </a>

                <div className="mt-3">
                  <ReviewDecisionForm
                    kind="document"
                    id={doc.id}
                    candidateId={doc.candidate_id}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t("historyTitle")} description={t("historyDescription")}>
        {history.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("noHistory")}</p>
        ) : (
          <ul className="space-y-3 py-1">
            {history.map((doc) => (
              <li
                key={doc.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CandidateRef
                    candidate={doc.candidates}
                    candidateId={doc.candidate_id}
                  />
                  <StatusBadge status={doc.verification_status} />
                </div>

                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {tEnums(`documentType.${doc.document_type}`)}
                </p>
                <p className="mt-0.5 break-all text-xs text-gray-500">
                  {doc.original_filename}
                </p>

                {renderMeta(doc)}

                {doc.review_note && (
                  <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-medium">{t("reviewNote")}: </span>
                    {doc.review_note}
                  </p>
                )}

                <a
                  href={`/api/documents/view?id=${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-blue-700 underline"
                >
                  {t("view")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
