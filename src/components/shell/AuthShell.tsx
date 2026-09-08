import BrandMark from "@/components/shell/BrandMark";
import LocaleSwitcher from "@/components/LocaleSwitcher";

/** Centred, quiet entry surface shared by all sign-in and password screens. */
export default function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-5 sm:px-8">
        <BrandMark tone="dark" />
        <LocaleSwitcher />
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <div className="rounded-lg border border-hairline bg-surface p-6 shadow-panel">
            <h1 className="t-page-title">{title}</h1>
            {description && <p className="t-body mt-1.5">{description}</p>}
            <div className="mt-5">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
