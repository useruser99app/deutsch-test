/**
 * Label/value pairs in a responsive grid instead of one full-width row per
 * field. Keeps profile sections compact and scannable.
 */
export function InfoGrid({
  children,
  columns = 3,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const columnClass =
    columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <dl className={`grid gap-x-8 gap-y-3.5 ${columnClass}`}>{children}</dl>
  );
}

export function InfoItem({
  label,
  children,
  wide = false,
  empty = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  /** Spans the full grid width — for long free text. */
  wide?: boolean;
  /** No value stored: quieter than real data, but still legible. */
  empty?: boolean;
  hint?: React.ReactNode;
}) {
  // `bdi` isolates a value AND resolves its direction from its own content,
  // which is what a plain text value needs: B2, NOR-00011, an e-mail or a
  // German occupation name stays LTR inside Arabic copy, an Arabic value
  // stays RTL. It must NOT wrap composed markup — a list or a badge row
  // would then inherit the direction of its first strong character and flip
  // the whole layout. Those children isolate their own text instead.
  const isText = typeof children === "string" || typeof children === "number";

  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <dt className="t-label">{label}</dt>
      <dd
        className={`t-value mt-0.5 break-words ${
          empty ? "t-empty" : ""
        }`}
      >
        {isText ? (
          // Long free text reads in its own language's direction, but the
          // box stays anchored to the page's start edge so it never drifts
          // to the far side of the panel, away from its label.
          <bdi
            className={
              wide ? "inline-block max-w-[68ch] align-top" : undefined
            }
          >
            {children}
          </bdi>
        ) : (
          children
        )}
      </dd>
      {hint && <div className="mt-1.5">{hint}</div>}
    </div>
  );
}
