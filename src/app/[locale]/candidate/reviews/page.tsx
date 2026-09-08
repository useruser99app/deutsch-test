import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadChangeItems } from "@/lib/candidate-data";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import EmptyState from "@/components/ui/EmptyState";
import ChangeItemRow from "@/components/candidate/ChangeItemRow";

export default async function CandidateReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "candidate");

  const t = await getTranslations("candidate.reviews");
  const { pending, history } = await loadChangeItems(supabase);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <Panel title={t("pendingTitle")} description={t("pendingDescription")}>
        {pending.length === 0 ? (
          <EmptyState message={t("noPending")} compact />
        ) : (
          <ul className="space-y-3">
            {pending.map((item) => (
              <ChangeItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-6">
        <Panel title={t("historyTitle")} description={t("historyDescription")}>
          {history.length === 0 ? (
            <EmptyState message={t("noHistory")} compact />
          ) : (
            <ul className="space-y-3">
              {history.map((item) => (
                <ChangeItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
