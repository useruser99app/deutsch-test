/**
 * Grouping container. Deliberately one hairline and a flat surface — depth
 * comes from spacing and typography, not from stacked cards and shadows.
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
  return (
    <section className="rounded-lg border border-hairline bg-surface shadow-panel">
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="t-section-title">{title}</h2>}
            {description && <p className="t-meta mt-1">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div
        className={
          bleed
            ? title
              ? "border-t border-hairline"
              : ""
            : title
              ? "px-5 pb-5"
              : "p-5"
        }
      >
        {children}
      </div>
    </section>
  );
}
