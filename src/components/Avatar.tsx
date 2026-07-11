const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-lg",
  lg: "h-24 w-24 text-2xl",
  xl: "h-32 w-32 text-3xl",
} as const;

interface AvatarProps {
  name: string;
  photoUrl?: string;
  color?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function Avatar({ name, photoUrl, color = "#375ca8", size = "md", className = "" }: AvatarProps) {
  const initial = name.trim().charAt(0) || "?";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
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
