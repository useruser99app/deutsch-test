export default function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-gray-500">{description}</p>
          )}
        </div>
        {action}
      </header>
      <div className="px-4 py-3 sm:px-5">{children}</div>
    </section>
  );
}
