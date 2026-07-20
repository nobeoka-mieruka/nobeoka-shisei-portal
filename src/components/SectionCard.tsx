import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  titleClassName?: string;
}

export function SectionCard({
  title,
  children,
  className = "",
  action,
  titleClassName = "text-base font-semibold text-on-surface",
}: SectionCardProps) {
  return (
    <section className={`rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={titleClassName}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
