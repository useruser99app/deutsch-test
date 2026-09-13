import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadDecidedDocuments, loadPendingDocuments } from "@/lib/admin-data";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import DocumentRow from "@/components/admin/DocumentRow";

export default async function AdminDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.documents");

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
          .select("id, original_filename")
          .in("id", replacedIds)
      : { data: [] };
  const replacedById = new Map(
    ((replacedRows ?? []) as { id: string; original_filename: string }[]).map(
      (row) => [row.id, row.original_filename]
    )
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        description={
          pending.length > 0 ? t("queueCount", { count: pending.length }) : t("empty")
        }
      />

      {pending.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <div className="rounded-lg border border-hairline bg-surface">
          <ul className="divide-y divide-hairline">
            {pending.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                candidate={doc.candidates}
                candidateId={doc.candidate_id}
                replacedFilename={
                  doc.replaces_document_id
                    ? replacedById.get(doc.replaces_document_id)
                    : undefined
                }
                actionable
              />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <Panel title={t("historyTitle")} description={t("historyDescription")} bleed>
          {history.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noHistory")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {history.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  candidate={doc.candidates}
                  candidateId={doc.candidate_id}
                  replacedFilename={
                    doc.replaces_document_id
                      ? replacedById.get(doc.replaces_document_id)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
