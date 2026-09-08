import { useTranslations } from "next-intl";
import StatusBadge from "@/components/ui/StatusBadge";
import CandidateIdentity, {
  type CandidateIdentityData,
} from "@/components/ui/CandidateIdentity";
import ReviewDecisionForm from "@/components/admin/ReviewDecisionForm";
import type { CandidateDocument } from "@/lib/domain";

/**
 * One document as a scannable review unit: who it belongs to, what it is,
 * when it arrived, its status, how to open it, and — when it is waiting —
 * the decision. Documents open through the existing signed-URL route only.
 */
export default function DocumentRow({
  document,
  candidate,
  candidateId,
  replacedFilename,
  actionable = false,
}: {
  document: CandidateDocument;
  candidate?: CandidateIdentityData | null;
  candidateId?: string;
  replacedFilename?: string;
  actionable?: boolean;
}) {
  const t = useTranslations("admin.documents");
  const tEnums = useTranslations("enums");

  return (
    <li className="px-5 py-4">
      {candidate && (
        <div className="mb-3">
          <CandidateIdentity
            candidate={candidate}
            candidateId={candidateId}
            size="sm"
          />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">
            {tEnums(`documentType.${document.document_type}`)}
          </p>
          <p className="t-meta mt-0.5 break-all">
            {document.original_filename}
          </p>
        </div>
        <StatusBadge status={document.verification_status} size="sm" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="t-meta">
          {t("uploadedAt")}: {document.uploaded_at.slice(0, 10)}
        </span>
        {document.reviewed_at && (
          <span className="t-meta">
            {t("reviewedAt")}: {document.reviewed_at.slice(0, 10)}
          </span>
        )}
        {replacedFilename && (
          <span className="t-meta">
            {t("replaces")}: <span className="break-all">{replacedFilename}</span>
          </span>
        )}
        <a
          href={`/api/documents/view?id=${document.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-accent hover:underline"
        >
          {t("view")}
        </a>
      </div>

      {replacedFilename && actionable && (
        <p className="mt-2 rounded-md border border-accent/20 bg-accent-soft px-3 py-2 text-xs text-accent">
          {t("supersedeHint")}
        </p>
      )}

      {document.review_note && (
        <p className="t-body mt-2 rounded-md bg-ink-50 px-3 py-2">
          <span className="font-medium">{t("reviewNote")}: </span>
          {document.review_note}
        </p>
      )}

      {actionable && (
        <div className="mt-3">
          <ReviewDecisionForm
            kind="document"
            id={document.id}
            candidateId={candidateId}
          />
        </div>
      )}
    </li>
  );
}
