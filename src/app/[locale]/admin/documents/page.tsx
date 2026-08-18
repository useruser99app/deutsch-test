import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { reviewDocument } from "@/lib/actions/admin";
import type { CandidateDocument } from "@/lib/domain";

interface PendingDocument extends CandidateDocument {
  candidates: {
    candidate_code: string;
    first_name: string;
    last_name: string;
  } | null;
}

export default async function AdminDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { ok, error } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "admin");

  const t = await getTranslations("admin.documents");
  const tEnums = await getTranslations("enums");

  const { data: documents } = await supabase
    .from("candidate_documents")
    .select("*, candidates ( candidate_code, first_name, last_name )")
    .eq("verification_status", "pending_review")
    .order("uploaded_at", { ascending: true });

  const pending = (documents ?? []) as PendingDocument[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("done")}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("error")}
        </p>
      )}

      {pending.length === 0 ? (
        <p className="text-sm text-gray-600">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {pending.map((doc) => (
            <li
              key={doc.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span className="font-mono font-medium text-gray-900">
                  {doc.candidates?.candidate_code ?? "—"}
                </span>
                <span>
                  {doc.candidates
                    ? `${doc.candidates.first_name} ${doc.candidates.last_name}`
                    : ""}
                </span>
                <span>
                  {t("type")}: {tEnums(`documentType.${doc.document_type}`)}
                </span>
                <span>
                  {t("filename")}: {doc.original_filename}
                </span>
                <span>
                  {t("uploadedAt")}: {doc.uploaded_at.slice(0, 10)}
                </span>
                <a
                  href={`/api/documents/view?id=${doc.id}`}
                  target="_blank"
                  className="text-blue-700 underline"
                >
                  {t("view")}
                </a>
              </div>

              <form
                action={reviewDocument}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="document_id" value={doc.id} />
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">{t("note")}</span>
                  <input
                    type="text"
                    name="note"
                    className="w-64 rounded-md border border-gray-300 px-3 py-1.5"
                  />
                </label>
                <button
                  type="submit"
                  name="decision"
                  value="approve"
                  className="rounded-md bg-green-700 px-4 py-1.5 text-sm text-white hover:bg-green-600"
                >
                  {t("approve")}
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="reject"
                  className="rounded-md bg-red-700 px-4 py-1.5 text-sm text-white hover:bg-red-600"
                >
                  {t("reject")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
