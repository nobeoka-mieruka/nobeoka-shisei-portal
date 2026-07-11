import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "./icons";

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="tap-highlight-none inline-flex items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ChevronLeftIcon className="h-5 w-5" />
      {label}
    </Link>
  );
}
