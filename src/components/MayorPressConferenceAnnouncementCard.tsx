import type { MayorPressConferenceAnnouncement } from "../data/mayorPressConferences";
import { DocumentIcon } from "./icons";

export function MayorPressConferenceAnnouncementCard({
  announcement,
}: {
  announcement: MayorPressConferenceAnnouncement;
}) {
  return (
    <li className="rounded-xl border border-outline-variant p-4">
      <span className="inline-flex rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
        {announcement.category}
      </span>
      <h3 className="mt-2 text-sm font-semibold leading-relaxed text-on-surface break-words">
        {announcement.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant break-words">{announcement.summary}</p>

      {announcement.keyInfo.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-surface-container-high p-3 text-xs leading-relaxed text-on-surface">
          {announcement.keyInfo.map((info, i) => (
            <li key={i} className="break-words">
              ・{info}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-on-surface-variant break-words">
        担当課：{announcement.department}
        {announcement.departmentPhone && <>（TEL {announcement.departmentPhone}）</>}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {announcement.pdfs.map((pdf) => (
          <a
            key={pdf.url}
            href={pdf.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${announcement.title} ${pdf.label}を新しいタブで開く`}
            className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <DocumentIcon className="h-3.5 w-3.5 shrink-0" />
            {pdf.label}
            <span aria-hidden>（外部サイト）</span>
          </a>
        ))}
      </div>
    </li>
  );
}
