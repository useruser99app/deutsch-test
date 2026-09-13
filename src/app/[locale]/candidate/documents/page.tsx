import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadDocuments } from "@/lib/candidate-data";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import DocumentUploadForm from "@/components/candidate/DocumentUploadForm";

export default async function CandidateDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "candidate");

  const t = await getTranslations("candidate.documents");
  const tEnums = await getTranslations("enums");

  const documents = await loadDocuments(supabase);
  const byId = new Map(documents.map((doc) => [doc.id, doc]));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <Panel title={t("upload")}>
        <DocumentUploadForm />
      </Panel>

      <div className="mt-6">
        <Panel title={t("listTitle")} bleed>
          {documents.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noDocuments")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {documents.map((doc) => {
                const replaced = doc.replaces_document_id
                  ? byId.get(doc.replaces_document_id)
                  : null;

                return (
                  <li key={doc.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-900">
                          {tEnums(`documentType.${doc.document_type}`)}
                        </p>
                        <p className="t-meta mt-0.5 break-all">
                          {doc.original_filename}
                        </p>
                      </div>
                      <StatusBadge status={doc.verification_status} size="sm" />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
                      <span className="t-meta">
                        {t("uploadedAt")}: {doc.uploaded_at.slice(0, 10)}
                      </span>
                      {doc.reviewed_at && (
                        <span className="t-meta">
                          {t("reviewedAt")}: {doc.reviewed_at.slice(0, 10)}
                        </span>
                      )}
                      {replaced && (
                        <span className="t-meta">
                          {t("replaces")}:{" "}
                          <span className="break-all">
                            {replaced.original_filename}
                          </span>
                        </span>
                      )}
                    </div>

                    {doc.verification_status === "superseded" && (
                      <p className="t-meta mt-2">{t("supersededNote")}</p>
                    )}
                    {doc.review_note && (
                      <p className="t-body mt-2 rounded-md bg-ink-50 px-3 py-2">
                        <span className="font-medium">
                          {t("reviewNoteLabel")}:{" "}
                        </span>
                        {doc.review_note}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
