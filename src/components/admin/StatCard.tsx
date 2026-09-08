import { Link } from "@/i18n/navigation";

/**
 * One operational number with a direct route into the work it represents.
 * Highlighted when there is something waiting for the reviewer.
 */
export default function StatCard({
  label,
  value,
  href,
  actionLabel,
  emphasis = false,
}: {
  label: string;
  value: number;
  href: string;
  actionLabel: string;
  emphasis?: boolean;
}) {
  const needsAttention = emphasis && value > 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        needsAttention
          ? "border-amber-300 bg-amber-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-sm text-gray-600">{label}</p>
      <p
        className={`my-1 text-3xl font-semibold ${
          needsAttention ? "text-amber-900" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      <Link
        href={href}
        className="text-sm font-medium text-blue-700 underline underline-offset-2"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
