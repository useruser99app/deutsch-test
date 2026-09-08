/**
 * Label/value pairs in a responsive grid instead of one full-width row per
 * field. Keeps profile sections compact and scannable.
 */
export function InfoGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <dl
      className={`grid gap-x-8 gap-y-4 sm:grid-cols-2 ${
        columns === 3 ? "lg:grid-cols-3" : ""
      }`}
    >
      {children}
    </dl>
  );
}

export function InfoItem({
  label,
  children,
  wide = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  /** Spans the full grid width — for long free text. */
  wide?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <dt className="t-label">{label}</dt>
      <dd className="t-value mt-1 break-words">{children}</dd>
      {hint && <div className="mt-1.5">{hint}</div>}
    </div>
  );
}
