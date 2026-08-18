import { useTranslations } from "next-intl";

const tones: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  active: "bg-green-100 text-green-800",
  published: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  pending_review: "bg-amber-100 text-amber-800",
  pending_verification: "bg-amber-100 text-amber-800",
  invited: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
};

export default function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  const tone = tones[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      {t.has(status) ? t(status) : status}
    </span>
  );
}
