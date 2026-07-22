import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  ...props,
});

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.75" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 11.5L12 4l8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function LandmarkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 21h16M5 21V10M19 21V10M4 10l8-5 8 5M8 10v11M12 10v11M16 10v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M4 4l7.5 8.5L4.5 20h2.3l6.2-6.9 5 6.9H20l-7.8-9L19 4h-2.3l-5.7 6.4L6.3 4H4z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M14 21v-7h2.5l.5-3H14V9c0-.9.3-1.5 1.7-1.5H17V5c-.3 0-1.3-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2H8.5v3H11v7h3z"
        fill="currentColor"
      />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.6" cy="7.4" r="1" fill="currentColor" />
    </svg>
  );
}

export function YoutubeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M10.5 9.5l5 2.5-5 2.5v-5z" fill="currentColor" />
    </svg>
  );
}

export function LineIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="14" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M7 8.5v5M10.5 8.5v5M10.5 8.5L14 13.5M14 8.5v5M16.2 8.5v5h1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ThreadsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3c-4.4 0-7 2.6-7 7v4c0 4.4 2.6 7 7 7s7-2.6 7-7c0-2.5-1.4-3.8-3.4-4.3.1-2-1-3.2-2.8-3.2-1.4 0-2.4.7-2.9 1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.3 12.5c.15 2.6-1.3 4-3.4 4-1.7 0-2.9-.9-2.9-2.2 0-1.5 1.4-2.3 3.3-2.3.9 0 1.7.1 2.4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M4 12h16M12 4c2.2 2.2 3.3 5 3.3 8s-1.1 5.8-3.3 8c-2.2-2.2-3.3-5-3.3-8s1.1-5.8 3.3-8z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ChartBarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M4 20V11M10 20V4M16 20V13M4 20h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function YenIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M6 4l6 8 6-8M12 12v8M8 15h8M8 18h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M10.5 9l4.5 3-4.5 3V9z" fill="currentColor" />
    </svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M14.8 9.2L13 13l-3.8 1.8L11 11l3.8-1.8z" fill="currentColor" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ChildIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5 21v-2a7 7 0 0114 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 20.3C7.3 17 3.3 13.6 3.3 9.6a5 5 0 019.1-2.9 5 5 0 019.1 2.9c0 4-4 7.4-8.7 10.7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LifeBuoyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RecycleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12a7.5 7.5 0 0112.3-5.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19.5 12a7.5 7.5 0 01-12.3 5.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14.3 3.8l2.5 2.5-2.9.9M9.7 20.2l-2.5-2.5 2.9-.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3.3s6.2 7.1 6.2 11.2a6.2 6.2 0 01-12.4 0C5.8 10.4 12 3.3 12 3.3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BriefcaseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4l9 15.5H3L12 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

export function QuestionMarkCircleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.3 9.2a2.7 2.7 0 115.1 1.6c-.7.7-1.4 1.1-1.4 2.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16.7" r="1" fill="currentColor" />
    </svg>
  );
}

/** 進捗状況バッジ用：達成・実施済みを表す。 */
export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12.3l2.6 2.6L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 進捗状況バッジ用：進行中を表す。市役所案内の受付時間アイコンとしても共用する。 */
export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5.3l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 進捗状況バッジ用：未着手を表す。 */
export function MinusCircleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 進捗状況バッジ用：方針変更を表す。 */
export function ArrowPathIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M5 11a7 7 0 0112-4.5M19 6v4h-4M19 13a7 7 0 01-12 4.5M5 18v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M5.5 4.5h3l1.5 4-2 1.5a11 11 0 005.5 5.5l1.5-2 4 1.5v3c0 1-.9 1.8-1.9 1.6C10.9 19 5 13.1 3.9 6.4 3.7 5.4 4.5 4.5 5.5 4.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="4" width="10" height="16" rx="1" stroke="currentColor" strokeWidth="2" />
      <path d="M15 9h4v11h-4M8 8h1M11 8h1M8 11h1M11 11h1M8 14h1M11 14h1M8 17h1M11 17h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
