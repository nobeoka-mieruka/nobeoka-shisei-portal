const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-lg",
  lg: "h-24 w-24 text-2xl",
  xl: "h-32 w-32 text-3xl",
} as const;

/** sizeClassesの高さ・幅と対応するpx値。imgのwidth/height属性でCLSを防ぐために使う。 */
const sizePx = { sm: 40, md: 64, lg: 96, xl: 128 } as const;

interface AvatarProps {
  name: string;
  photoUrl?: string;
  color?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
  /** 一覧に多数並ぶ場合は既定の"lazy"のままにし、詳細ページの単体表示など画面上部に出る場合は"eager"を指定する。 */
  loading?: "lazy" | "eager";
}

export function Avatar({
  name,
  photoUrl,
  color = "#375ca8",
  size = "md",
  className = "",
  loading = "lazy",
}: AvatarProps) {
  const initial = name.trim().charAt(0) || "?";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={sizePx[size]}
        height={sizePx[size]}
        loading={loading}
        decoding="async"
        className={`${sizeClasses[size]} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={`flex ${sizeClasses[size]} shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{ backgroundColor: `${color}26`, color }}
    >
      <span aria-hidden>{initial}</span>
    </div>
  );
}
