export type TimeWindow = 'jetzt' | 'demnaechst' | 'bald';

export function getTimeWindow(isoDate: string): TimeWindow {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sparringDay = new Date(isoDate);
  sparringDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (sparringDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return 'jetzt';
  if (diffDays <= 7) return 'demnaechst';
  return 'bald';
}
