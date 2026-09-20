/**
 * The page's identity line. Kept deliberately short: on a laptop the first
 * screen should be filled with the work, not with a title block, so there is
 * no oversized hero area and no decorative spacing above the content.
 *
 * Design System 2.0 adds two optional steps — an `eyebrow` that names the
 * surface and a `size="display"` title. Both are opt-in, so every page that
 * has not been migrated renders exactly as before.
 */
export default function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  eyebrow,
  size = "default",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  /** Small line above the title naming the surface, e.g. the marketplace. */
  eyebrow?: string;
  /** "display" opens a workflow; "default" labels a page. */
  size?: "default" | "display";
}) {
  const isDisplay = size === "display";

  return (
    <header className={isDisplay ? "mb-stack" : "mb-5"}>
      {breadcrumb && <div className="mb-1.5">{breadcrumb}</div>}
      <div
        className={`flex flex-wrap justify-between gap-x-4 gap-y-2 ${
          isDisplay ? "items-start" : "items-center"
        }`}
      >
        <div className="min-w-0">
          {eyebrow && <p className="t-eyebrow mb-1.5">{eyebrow}</p>}
          {/* A display title wraps: it is a sentence, and truncating a
              sentence to one line loses the point of having one. */}
          <h1 className={isDisplay ? "t-display max-w-[28ch]" : "t-page-title truncate"}>
            {title}
          </h1>
          {description && (
            <p className={isDisplay ? "t-lead mt-2 max-w-[62ch]" : "t-meta mt-0.5 max-w-2xl"}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
