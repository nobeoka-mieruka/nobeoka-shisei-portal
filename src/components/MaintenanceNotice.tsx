import { maintenanceNotice } from "../config/site";
import { InfoIcon } from "./icons";

export function MaintenanceNotice() {
  if (!maintenanceNotice.enabled) return null;

  return (
    <div className="border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6 print:hidden">
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-on-surface">{maintenanceNotice.title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-on-surface-variant">{maintenanceNotice.message}</p>
        </div>
      </div>
    </div>
  );
}
