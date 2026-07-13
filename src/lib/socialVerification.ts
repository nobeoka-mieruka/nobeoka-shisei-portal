import type { SocialVerificationStatus } from "../types";

export const socialVerificationMeta: Record<SocialVerificationStatus, { label: string; className: string }> = {
  verified: {
    label: "公式確認済み",
    className: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  },
  unverified: {
    label: "本人と思われるアカウントですが、公式確認はできていません",
    className: "bg-surface-container-high text-on-surface-variant",
  },
  not_found: {
    label: "公式アカウントを公開情報から確認できませんでした",
    className: "bg-surface-container-high text-on-surface-variant",
  },
  inactive: {
    label: "公式アカウントですが、長期間投稿が確認できません",
    className: "bg-[#fff3d6] text-[#7a5900] dark:bg-[#3a2e00] dark:text-[#f2cf6b]",
  },
};
