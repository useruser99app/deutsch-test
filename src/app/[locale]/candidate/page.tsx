import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadCandidateSnapshot,
  loadChangeItems,
  loadDocuments,
} from "@/lib/candidate-data";
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
  const openCount = pending.length + pendingDocuments.length;

  // Exactly one primary next step, phrased without internal terminology.
  const nextStep =
    documents.length === 0
      ? {
          text: t("hintNoDocuments"),
          href: "/candidate/documents",
          cta: t("uploadDocument"),
        }
      : openCount > 0
        ? {
            text:
              pending.length > 0
                ? t("hintPendingChanges", { count: pending.length })
                : t("hintPendingDocuments", { count: pendingDocuments.length }),
            href: "/candidate/reviews",
            cta: tReviews("title"),
          }
        : {
            text: t("hintAllClear"),
            href: "/candidate/changes",
            cta: t("proposeChanges"),
          };

  // The secondary link is always a different destination than the primary.
  const secondary =
    nextStep.href === "/candidate/changes"
      ? { href: "/candidate/documents", label: t("uploadDocument") }
      : { href: "/candidate/changes", label: t("proposeChanges") };

  return (
    <>
      <PageHeader title={t("greeting", { name: candidate.first_name })} />

      {/* Status and next step — one primary action, no duplication. */}
      <section className="rounded-lg border border-hairline bg-surface shadow-panel">
        <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="mt-1 text-lg font-semibold text-ink-900 tabular-nums">
              {openCount}
            </p>
          </div>
          <div>
            <p className="t-label">{tFields("german_level")}</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">
              <bdi>{candidate.german_level}</bdi>
            </p>
          </div>
          <div>
            <p className="t-label">{tFields("candidate_code")}</p>
            <p className="t-value mt-1 font-mono">
              <bdi>{candidate.candidate_code}</bdi>
            </p>
            <p className="t-meta">
              {tEnums(`candidateType.${candidate.candidate_type}`)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-accent-soft px-5 py-4">
          <p className="t-body max-w-xl text-ink-800">{nextStep.text}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={secondary.href} className="text-sm font-medium text-accent hover:underline">
              {secondary.label}
            </Link>
            <Link href={nextStep.href} className={buttonClass("primary", "sm")}>
              {nextStep.cta}
            </Link>
          </div>
        </div>

        <p className="t-meta border-t border-hairline px-5 py-3">
          {t("approvalNote")}
        </p>
      </section>

      {/* The whole approved profile as one surface with internal dividers. */}
      <div className="mt-6">
        <Panel title={t("approvedData")} bleed>
          <ProfileFields
            snapshot={snapshot}
            pendingValues={pendingByField}
            columns={3}
          />
        </Panel>
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
                      <bdi>{doc.original_filename}</bdi>
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
