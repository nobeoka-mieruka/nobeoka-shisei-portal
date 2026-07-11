export function EmptyState({ message = "現在、掲載情報はありません" }: { message?: string }) {
  return <p className="py-2 text-sm text-on-surface-variant">{message}</p>;
}
