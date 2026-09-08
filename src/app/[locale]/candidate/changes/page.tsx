import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import {
  approvedValue,
  loadCandidateSnapshot,
  loadChangeItems,
} from "@/lib/candidate-data";
import { fieldsFor } from "@/lib/candidate-fields";
import ChangeForm from "@/components/candidate/ChangeForm";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

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
    return <EmptyState message={tDashboard("noRecord")} />;
  }

  const { pending } = await loadChangeItems(supabase);

  // Only the fields the change registry actually accepts for this type.
  const approved: Record<string, unknown> = {};
  for (const field of fieldsFor(snapshot.candidate.candidate_type)) {
    approved[field.key] = approvedValue(snapshot, field.key);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("description")} />

      <ChangeForm
        candidateType={snapshot.candidate.candidate_type}
        approved={approved}
        pendingKeys={pending.map((item) => item.field_key)}
        defaultSourceLanguage={profile.preferred_locale}
      />
    </div>
  );
}
