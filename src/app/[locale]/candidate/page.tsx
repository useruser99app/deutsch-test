import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadCandidateSnapshot,
  loadChangeItems,
  loadDocuments,
} from "@/lib/candidate-data";
import { fieldSections, fieldsForSection } from "@/lib/candidate-fields";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/button";
import ProfileFields from "@/components/candidate/ProfileFields";

export default async function CandidateDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, "candidate");

  const t = await getTranslations("candidate.dashboard");
  const tSections = await getTranslations("candidate.sections");
  const tEnums = await getTranslations("enums");
  const tReviews = await getTranslations("candidate.reviews");
  const tDocs = await getTranslations("candidate.documents");
  const tFields = await getTranslations("fields");

  const snapshot = await loadCandidateSnapshot(supabase);
  if (!snapshot) {
    return <EmptyState message={t("noRecord")} />;
  }

  const [{ pending, history }, documents] = await Promise.all([
    loadChangeItems(supabase),
    loadDocuments(supabase),
  ]);

  const { candidate } = snapshot;
  const pendingByField = new Map(
    pending.map((item) => [item.field_key, item.proposed_value])
  );
  const pendingDocuments = documents.filter(
    (doc) => doc.verification_status === "pending_review"
  );

  // One concrete next step, phrased without internal terminology (§10).
  const nextStep =
    documents.length === 0
      ? { text: t("hintNoDocuments"), href: "/candidate/documents", cta: t("uploadDocument") }
      : pending.length > 0 || pendingDocuments.length > 0
        ? {
            text:
              pending.length > 0
                ? t("hintPendingChanges", { count: pending.length })
                : t("hintPendingDocuments", { count: pendingDocuments.length }),
            href: "/candidate/reviews",
            cta: tReviews("title"),
          }
        : { text: t("hintAllClear"), href: "/candidate/changes", cta: t("proposeChanges") };

  return (
    <>
      <PageHeader
        title={t("greeting", { name: candidate.first_name })}
        actions={
          <>
            <Link href="/candidate/changes" className={buttonClass("primary")}>
              {t("proposeChanges")}
            </Link>
            <Link href="/candidate/documents" className={buttonClass("secondary")}>
              {t("uploadDocument")}
            </Link>
          </>
        }
      />

      {/* Status and next step — the four questions, answered at the top. */}
      <section className="rounded-lg border border-hairline bg-surface p-5 shadow-panel">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="t-label">{t("profileStatus")}</p>
            <div className="mt-1.5">
              {snapshot.profile ? (
                <StatusBadge status={snapshot.profile.profile_status} />
              ) : (
                <span className="t-meta">{t("noProfile")}</span>
              )}
            </div>
          </div>
          <div>
            <p className="t-label">{tReviews("pendingTitle")}</p>
            <p className="mt-1 text-sm font-semibold text-ink-900 tabular-nums">
              {pending.length + pendingDocuments.length}
            </p>
          </div>
          <div className="ms-auto text-end">
            <p className="t-label">{tEnums(`candidateType.${candidate.candidate_type}`)}</p>
            <p className="t-meta mt-1 font-mono">{candidate.candidate_code}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/20 bg-accent-soft px-4 py-3">
          <p className="text-sm text-ink-800">{nextStep.text}</p>
          <Link href={nextStep.href} className={buttonClass("primary", "sm")}>
            {nextStep.cta}
          </Link>
        </div>

        <p className="t-meta mt-3">{t("approvalNote")}</p>
      </section>

      {/* Approved profile, compact */}
      <div className="mt-6 space-y-6">
        {fieldSections.map((section) => {
          if (fieldsForSection(candidate.candidate_type, section).length === 0) {
            return null;
          }
          return (
            <Panel key={section} title={tSections(section)}>
              <ProfileFields
                snapshot={snapshot}
                section={section}
                pendingValues={pendingByField}
                columns={2}
              />
            </Panel>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title={tDocs("title")}
          action={
            <Link
              href="/candidate/documents"
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("openSection")}
            </Link>
          }
          bleed
        >
          {documents.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noDocuments")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {documents.slice(0, 5).map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-900">
                      {tEnums(`documentType.${doc.document_type}`)}
                    </span>
                    <span className="t-meta block truncate">
                      {doc.original_filename}
                    </span>
                  </span>
                  <StatusBadge status={doc.verification_status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={tReviews("title")}
          action={
            <Link
              href="/candidate/reviews"
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("openSection")}
            </Link>
          }
          bleed
        >
          {pending.length === 0 && history.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t("noPendingChanges")} compact />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {[...pending, ...history].slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="t-value">
                    {tFields.has(item.field_key)
                      ? tFields(item.field_key)
                      : item.field_key}
                  </span>
                  <StatusBadge status={item.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
