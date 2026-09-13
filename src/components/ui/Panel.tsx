/**
 * Grouping container.
 *
 * Flat by design: one hairline, no shadow, a ruled header. A page made of
 * floating shadowed boxes reads as a template; a page made of ruled sections
 * reads as operations software, and the rule also gives the eye a line to
 * scan along. Depth comes from spacing and typography instead.
 */
export default function Panel({
  title,
  description,
  action,
  children,
  bleed = false,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Content spans the full panel width (tables, dense lists). */
  bleed?: boolean;
}) {
  const hasHeader = Boolean(title || action);

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface">
      {hasHeader && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-hairline px-5 py-3">
          <div className="min-w-0">
            {title && <h2 className="t-section-title">{title}</h2>}
            {description && <p className="t-meta mt-0.5">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bleed ? "" : "p-5"}>{children}</div>
    </section>
  );
}
