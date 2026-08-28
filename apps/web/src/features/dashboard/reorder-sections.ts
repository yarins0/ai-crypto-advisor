import type { ContentType } from '@aca/shared';

/**
 * Moves `draggedType` into `targetType`'s slot, shifting the cards between
 * them over by one. Direction matters: dropping onto a card further along
 * lands after it (so the dragged card ends up in the target's old spot);
 * dropping onto an earlier card lands before it. "Always insert before" — the
 * simpler-looking version of this — is a no-op whenever the dragged card is
 * already the target's immediate predecessor, which broke every adjacent
 * forward drag.
 */
export function reorderSections(
  order: ContentType[],
  draggedType: ContentType,
  targetType: ContentType,
): ContentType[] {
  if (draggedType === targetType) return order;

  const draggedWasBeforeTarget = order.indexOf(draggedType) < order.indexOf(targetType);
  const withoutDragged = order.filter((type) => type !== draggedType);
  const targetIndex = withoutDragged.indexOf(targetType);
  const insertIndex = draggedWasBeforeTarget ? targetIndex + 1 : targetIndex;

  return [
    ...withoutDragged.slice(0, insertIndex),
    draggedType,
    ...withoutDragged.slice(insertIndex),
  ];
}
