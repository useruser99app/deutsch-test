import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { approveChangeItem, rejectChangeItem } from "@/lib/actions/admin";
import { formatJsonValue, type ChangeItem } from "@/lib/domain";

interface PendingItem extends ChangeItem {
  candidate_change_sets: {
    submitted_at: string;
    source: string;
    candidates: {
      candidate_code: string;
      first_name: string;
      last_name: string;
    } | null;
  } | null;
}

export default async function AdminReviewPage({
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

  const t = await getTranslations("admin.review");
  const tFields = await getTranslations("fields");

  const { data: items } = await supabase
    .from("candidate_change_items")
    .select(
      `*, candidate_change_sets ( submitted_at, source,
        candidates ( candidate_code, first_name, last_name ) )`
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const pending = (items ?? []) as PendingItem[];

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
          {pending.map((item) => {
            const set = item.candidate_change_sets;
            const candidate = set?.candidates;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span className="font-mono font-medium text-gray-900">
                    {candidate?.candidate_code ?? "—"}
                  </span>
                  <span>
                    {candidate
                      ? `${candidate.first_name} ${candidate.last_name}`
                      : ""}
                  </span>
                  <span>
                    {t("submittedAt")}:{" "}
                    {set ? set.submitted_at.slice(0, 10) : "—"}
                  </span>
                  <span>
                    {t("source")}: {set?.source ?? "—"}
                  </span>
                  {item.source_language && (
                    <span>
                      {t("sourceLanguage")}: {item.source_language}
                    </span>
                  )}
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {t("field")}
                    </p>
                    <p className="font-medium">
                      {tFields.has(item.field_key)
                        ? tFields(item.field_key)
                        : item.field_key}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {t("current")}
                    </p>
                    <p className="text-gray-700">
                      {formatJsonValue(item.current_value)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {t("proposed")}
                    </p>
                    <p className="font-semibold text-green-800">
                      {formatJsonValue(item.proposed_value)}
                    </p>
                  </div>
                </div>

                <form
                  action={approveChangeItem}
                  className="flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <label className="block text-sm">
                    <span className="mb-1 block text-gray-600">
                      {t("comment")}
                    </span>
                    <input
                      type="text"
                      name="comment"
                      className="w-64 rounded-md border border-gray-300 px-3 py-1.5"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md bg-green-700 px-4 py-1.5 text-sm text-white hover:bg-green-600"
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="submit"
                    formAction={rejectChangeItem}
                    className="rounded-md bg-red-700 px-4 py-1.5 text-sm text-white hover:bg-red-600"
                  >
                    {t("reject")}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
