/**
 * A dashboard surface in the Design System 2.0 language.
 *
 * Deliberately not `Panel`: that container is shared with the admin and
 * candidate workspaces, and restyling it would redesign pages this ticket
 * does not touch. Same tokens, same edges as the marketplace cards.
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
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hairline bg-surface-sunken px-4 py-2">
        <h2 className="mk-section">{title}</h2>
        {action}
      </header>
      <div className={bleed ? "" : "px-4 py-3.5"}>{children}</div>
    </section>
  );
}
