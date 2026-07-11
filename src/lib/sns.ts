import type { ComponentType, SVGProps } from "react";
import type { SNSPlatform } from "../types";
import {
  XIcon,
  FacebookIcon,
  InstagramIcon,
  YoutubeIcon,
  LineIcon,
  GlobeIcon,
} from "../components/icons";

export const snsMeta: Record<SNSPlatform, { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  x: { label: "X (Twitter)", Icon: XIcon },
  facebook: { label: "Facebook", Icon: FacebookIcon },
  instagram: { label: "Instagram", Icon: InstagramIcon },
  youtube: { label: "YouTube", Icon: YoutubeIcon },
  line: { label: "LINE", Icon: LineIcon },
  blog: { label: "ブログ", Icon: GlobeIcon },
  website: { label: "公式サイト", Icon: GlobeIcon },
};
