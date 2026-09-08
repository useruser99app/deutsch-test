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
    <header className="mb-6">
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-page-title">{title}</h1>
          {description && <p className="t-body mt-1 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
