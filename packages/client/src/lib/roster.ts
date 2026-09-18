/**
 * Turn order is a list the host can rearrange, both in the waiting room and
 * mid-year from the admin menu. Moving one player is the only edit either
 * screen needs, so both go through here.
 */
export function moveInOrder<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items;
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
