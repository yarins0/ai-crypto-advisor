import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContentType, DashboardResponse } from '@aca/shared';

import { DashboardSections } from '../features/dashboard/DashboardSections.js';
import { fetchVotes } from '../features/votes/api.js';
import { createQueryClient } from '../lib/query-client.js';

vi.mock('../features/votes/api.js', () => ({ fetchVotes: vi.fn(), castVote: vi.fn() }));

const FETCHED_AT = '2026-08-28T10:00:00.000Z';

function sectionOf<TData>(data: TData) {
  return { data, source: 'live' as const, fetchedAt: FETCHED_AT };
}

// An empty sparkline keeps the lazy chart out of a test about ordering.
const ALL_SECTIONS: DashboardResponse = {
  sections: {
    news: sectionOf([
      {
        id: 'news-1',
        title: 'A headline',
        url: 'https://example.com/1',
        publishedAt: FETCHED_AT,
        imageUrl: null,
      },
    ]),
    prices: sectionOf([
      {
        id: 'tron',
        symbol: 'trx',
        name: 'TRON',
        image: 'https://example.com/trx.png',
        currentPrice: 0.34,
        priceChangePercentage24h: 1.3,
        marketCap: 30_000_000_000,
        sparkline: [],
      },
    ]),
    insight: sectionOf({ id: '2026-08-28', text: 'A quiet day.', model: null }),
    memes: sectionOf({ id: 'wagmi-1', title: 'WAGMI', imageUrl: 'data:image/svg+xml,%3Csvg/%3E' }),
  },
  preferenceVersion: 3,
  generatedAt: FETCHED_AT,
};

const DEFAULT_ORDER: ContentType[] = ['news', 'prices', 'insight', 'memes'];

function renderSections(
  dashboard: DashboardResponse = ALL_SECTIONS,
  order: ContentType[] = DEFAULT_ORDER,
): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DashboardSections dashboard={dashboard} order={order} onReorder={vi.fn()} />
    </QueryClientProvider>,
  );
}

function renderedTitles(): (string | null)[] {
  return screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
}

describe('DashboardSections', () => {
  beforeEach(() => {
    vi.mocked(fetchVotes).mockResolvedValue({ votes: [] });
  });

  it('renders in the shared contentTypes order by default', () => {
    renderSections();

    expect(renderedTitles()).toEqual(['News', 'Prices', 'Insight of the day', 'Meme']);
  });

  it('drops a deselected section rather than rendering an empty card for it', () => {
    renderSections({
      ...ALL_SECTIONS,
      sections: { ...ALL_SECTIONS.sections, news: null, memes: null },
    });

    expect(renderedTitles()).toEqual(['Prices', 'Insight of the day']);
  });

  it('renders in the caller-supplied order rather than the default', () => {
    renderSections(ALL_SECTIONS, ['memes', 'news', 'insight', 'prices']);

    expect(renderedTitles()).toEqual(['Meme', 'News', 'Insight of the day', 'Prices']);
  });
});
