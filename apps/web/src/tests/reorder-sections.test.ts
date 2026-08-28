import { describe, expect, it } from 'vitest';

import type { ContentType } from '@aca/shared';

import { reorderSections } from '../features/dashboard/reorder-sections.js';

const ORDER: ContentType[] = ['news', 'prices', 'insight', 'memes'];

describe('reorderSections', () => {
  it('dropping onto a later card lands the dragged card just after it', () => {
    expect(reorderSections(ORDER, 'news', 'prices')).toEqual([
      'prices',
      'news',
      'insight',
      'memes',
    ]);
  });

  it('dropping onto an earlier card lands the dragged card just before it', () => {
    expect(reorderSections(ORDER, 'memes', 'prices')).toEqual([
      'news',
      'memes',
      'prices',
      'insight',
    ]);
  });

  it('moving a section onto itself is a no-op', () => {
    expect(reorderSections(ORDER, 'prices', 'prices')).toEqual(ORDER);
  });

  it('moving the first section onto the last lands it right after the last', () => {
    expect(reorderSections(ORDER, 'news', 'memes')).toEqual(['prices', 'insight', 'memes', 'news']);
  });

  it('moving the last section onto the first lands it right before the first', () => {
    expect(reorderSections(ORDER, 'memes', 'news')).toEqual(['memes', 'news', 'prices', 'insight']);
  });
});
