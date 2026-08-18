import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { uploadDocument } from "@/lib/actions/candidate";
import { documentTypes, type CandidateDocument } from "@/lib/domain";
import StatusBadge from "@/components/StatusBadge";

export default async function CandidateDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { ok, error } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "candidate");

  const t = await getTranslations("candidate.documents");
  const tEnums = await getTranslations("enums");

  const { data: documents } = await supabase
    .from("candidate_documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("success")}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("error")}
        </p>
      )}

      <form
        action={uploadDocument}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      >
        <input type="hidden" name="locale" value={locale} />
        <h2 className="text-lg font-semibold">{t("upload")}</h2>
        <div>
          <label
            className="mb-1 block text-sm text-gray-700"
            htmlFor="document_type"
          >
            {t("documentType")}
          </label>
          <select
            id="document_type"
            name="document_type"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {tEnums(`documentType.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-700" htmlFor="file">
            {t("file")}
          </label>
          <input
            id="file"
            type="file"
            name="file"
            required
            className="w-full text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          {t("submit")}
        </button>
      </form>

      {(documents ?? []).length === 0 ? (
        <p className="text-sm text-gray-600">{t("noDocuments")}</p>
      ) : (
        <ul className="space-y-2">
          {(documents ?? []).map((doc: CandidateDocument) => (
            <li
              key={doc.id}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">
                    {tEnums(`documentType.${doc.document_type}`)}
                  </span>{" "}
                  · {doc.original_filename}
                </span>
                <StatusBadge status={doc.verification_status} />
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {t("uploadedAt")}: {new Date(doc.uploaded_at).toISOString().slice(0, 10)}
                {doc.review_note && (
                  <span>
                    {" "}
                    · {t("reviewNote")}: {doc.review_note}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
