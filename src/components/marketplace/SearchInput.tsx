/**
 * The marketplace's primary search field: one occupation term, which is the
 * question an employer actually arrives with.
 *
 * A plain uncontrolled input inside the surrounding GET form — no client
 * state, no debounce, no autocomplete against the candidate pool (which
 * would leak what is in it before any filter is applied).
 */
export default function SearchInput({
  name,
  label,
  placeholder,
  defaultValue,
  id,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  id: string;
}) {
  return (
    // Full width until there is room for a real field beside the selects:
    // a search box truncating its own placeholder helps nobody.
    <div className="relative min-w-0 basis-full sm:basis-64 sm:flex-1">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-ink-500"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="h-4 w-4"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full rounded-control border border-hairline-strong bg-surface pe-3 ps-9 text-[15px] font-medium text-ink-900 transition-colors placeholder:font-normal placeholder:text-ink-400 hover:border-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm"
      />
    </div>
  );
}
