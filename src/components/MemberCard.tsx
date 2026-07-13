import { Link } from "react-router-dom";
import type { CouncilMember } from "../types";
import { getFaction } from "../lib/factions";
import { Avatar } from "./Avatar";
import { FactionChip } from "./FactionChip";
import { GlobeIcon } from "./icons";

export function MemberCard({ member }: { member: CouncilMember }) {
  const faction = getFaction(member.factionId);

  return (
    <div className="group relative flex min-w-0 flex-col items-center gap-2 overflow-hidden rounded-xl bg-surface-container-low p-4 text-center shadow-e1 transition hover:bg-surface-container hover:shadow-e2">
      <Link
        to={`/members/${member.id}`}
        aria-label={`${member.name}（${faction.name}）の詳細を見る`}
        className="tap-highlight-none absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
      />
      <Avatar name={member.name} photoUrl={member.photoUrl} color={faction.color} size="lg" />
      <div className="min-w-0 max-w-full">
        <p className="truncate text-base font-semibold text-on-surface">{member.name}</p>
        <p className="truncate text-sm text-on-surface-variant">{member.nameKana}</p>
      </div>
      <FactionChip faction={faction} />
      {(member.termCount || member.committees.length > 0) && (
        <div className="min-w-0 max-w-full space-y-0.5 text-sm text-on-surface-variant">
          {member.termCount && <p>当選{member.termCount}回</p>}
          {member.committees.length > 0 && (
            <p className="line-clamp-2 break-words text-xs">{member.committees.join("・")}</p>
          )}
        </div>
      )}
      {member.profileUrl && (
        <a
          href={member.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${member.name}の公式プロフィールを新しいタブで開く`}
          className="relative z-10 mt-0.5 inline-block max-w-full truncate rounded-full px-2.5 py-2 text-xs font-medium text-primary transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <GlobeIcon className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          公式プロフィール
        </a>
      )}
    </div>
  );
}
