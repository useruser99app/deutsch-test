import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadDocuments } from "@/lib/candidate-data";
import StatusBadge from "@/components/StatusBadge";
import SectionCard from "@/components/candidate/SectionCard";
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
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t("description")}</p>
      </header>

      <SectionCard title={t("upload")}>
        <DocumentUploadForm />
      </SectionCard>

      <SectionCard title={t("listTitle")}>
        {documents.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("noDocuments")}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((doc) => {
              const replaced = doc.replaces_document_id
                ? byId.get(doc.replaces_document_id)
                : null;

              return (
                <li key={doc.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
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
                        <dd className="break-all">
                          {replaced.original_filename}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {doc.verification_status === "superseded" && (
                    <p className="mt-2 text-xs text-gray-500">
                      {t("supersededNote")}
                    </p>
                  )}
                  {doc.review_note && (
                    <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      <span className="font-medium">{t("reviewNoteLabel")}: </span>
                      {doc.review_note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
