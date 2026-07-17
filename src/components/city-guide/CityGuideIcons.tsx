import type { CityGuideIconName } from "../../types/cityGuide";
import {
  AlertTriangleIcon,
  BriefcaseIcon,
  ChildIcon,
  DocumentIcon,
  DropletIcon,
  HeartIcon,
  HomeIcon,
  LifeBuoyIcon,
  QuestionMarkCircleIcon,
  RecycleIcon,
  YenIcon,
} from "../icons";

const iconMap: Record<CityGuideIconName, typeof DocumentIcon> = {
  document: DocumentIcon,
  yen: YenIcon,
  child: ChildIcon,
  heart: HeartIcon,
  support: LifeBuoyIcon,
  recycle: RecycleIcon,
  house: HomeIcon,
  droplet: DropletIcon,
  briefcase: BriefcaseIcon,
  alert: AlertTriangleIcon,
  question: QuestionMarkCircleIcon,
};

export function CityGuideCategoryIcon({ icon, className }: { icon: CityGuideIconName; className?: string }) {
  const Icon = iconMap[icon];
  return <Icon className={className} />;
}
