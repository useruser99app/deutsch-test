import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadChangeItems } from "@/lib/candidate-data";
import SectionCard from "@/components/candidate/SectionCard";
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
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t("description")}</p>
      </header>

      <SectionCard
        title={t("pendingTitle")}
        description={t("pendingDescription")}
      >
        {pending.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("noPending")}</p>
        ) : (
          <ul className="space-y-3 py-1">
            {pending.map((item) => (
              <ChangeItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={t("historyTitle")}
        description={t("historyDescription")}
      >
        {history.length === 0 ? (
          <p className="py-2 text-sm text-gray-600">{t("noHistory")}</p>
        ) : (
          <ul className="space-y-3 py-1">
            {history.map((item) => (
              <ChangeItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
