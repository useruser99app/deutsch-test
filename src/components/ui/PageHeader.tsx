/**
 * The page's identity line. Kept deliberately short: on a laptop the first
 * screen should be filled with the work, not with a title block, so there is
 * no oversized hero area and no decorative spacing above the content.
 */
export default function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <header className="mb-5">
      {breadcrumb && <div className="mb-1.5">{breadcrumb}</div>}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="t-page-title truncate">{title}</h1>
          {description && (
            <p className="t-meta mt-0.5 max-w-2xl">{description}</p>
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
