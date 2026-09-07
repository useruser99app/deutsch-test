import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import {
  approvedValue,
  loadCandidateSnapshot,
  loadChangeItems,
} from "@/lib/candidate-data";
import { fieldsFor } from "@/lib/candidate-fields";
import ChangeForm from "@/components/candidate/ChangeForm";

export default async function ProposeChangesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, profile } = await requireRole(locale, "candidate");

  const t = await getTranslations("candidate.changes");

  const snapshot = await loadCandidateSnapshot(supabase);
  if (!snapshot) {
    const tDashboard = await getTranslations("candidate.dashboard");
    return (
      <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        {tDashboard("noRecord")}
      </p>
    );
  }

  const { pending } = await loadChangeItems(supabase);

  // Only the fields the change registry actually accepts for this type.
  const approved: Record<string, unknown> = {};
  for (const field of fieldsFor(snapshot.candidate.candidate_type)) {
    approved[field.key] = approvedValue(snapshot, field.key);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t("description")}</p>
      </header>

      <ChangeForm
        candidateType={snapshot.candidate.candidate_type}
        approved={approved}
        pendingKeys={pending.map((item) => item.field_key)}
        defaultSourceLanguage={profile.preferred_locale}
      />
    </div>
  );
}
