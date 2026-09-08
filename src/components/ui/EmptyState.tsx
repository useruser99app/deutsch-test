/**
 * Shown when a section genuinely has no data. Never filled with invented
 * placeholder content (§18).
 */
export default function EmptyState({
  message,
  action,
  compact = false,
}: {
  message: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-dashed border-hairline text-center ${
        compact ? "px-4 py-6" : "px-6 py-10"
      }`}
    >
      <p className="t-body text-ink-500">{message}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
