/**
 * Drops items written by blocked users. Returns the same array instance when
 * nothing is removed, so memoized list cells keep their identity.
 */
export function withoutBlocked<T>(
  items: T[],
  blockedIds: ReadonlySet<string>,
  senderOf: (item: T) => string | null,
): T[] {
  if (blockedIds.size === 0) return items;
  const kept = items.filter((item) => {
    const sender = senderOf(item);
    return sender === null || !blockedIds.has(sender);
  });
  return kept.length === items.length ? items : kept;
}
