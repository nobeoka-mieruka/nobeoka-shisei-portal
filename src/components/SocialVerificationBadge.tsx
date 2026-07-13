import type { SocialVerificationStatus } from "../types";
import { socialVerificationMeta } from "../lib/socialVerification";

export function SocialVerificationBadge({ status }: { status?: SocialVerificationStatus }) {
  if (!status) return null;
  const meta = socialVerificationMeta[status];

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-snug ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
