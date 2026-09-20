/**
 * A dashboard surface in the Design System 2.0 language.
 *
 * Deliberately not `Panel`: that container is shared with the admin and
 * candidate workspaces, and restyling it would redesign pages this ticket
 * does not touch. Same tokens and edges as the marketplace cards, one step
 * up in title size so a dashboard section reads as a section.
 */
export default function DashboardCard({
  title,
  action,
  children,
  bleed = false,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Content spans the full card width (dense lists). */
  bleed?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-hairline-strong bg-surface shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hairline px-5 py-3">
        <h2 className="text-[15px] font-semibold leading-5 text-ink-900">
          {title}
        </h2>
        {action}
      </header>
      <div className={bleed ? "" : "px-5 py-4"}>{children}</div>
    </section>
  );
}
