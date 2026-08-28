import type { PricesSection } from '@aca/shared';

import { Card } from '../../components/Card.js';
import { Sparkline } from '../../components/Sparkline.js';
import { formatPercentChange, formatPrice } from '../../lib/format.js';
import { VoteButtons } from '../votes/VoteButtons.js';

interface PricesCardProps {
  section: PricesSection;
  preferenceVersion: number;
}

export function PricesCard({ section, preferenceVersion }: PricesCardProps) {
  return (
    <Card title="Prices" source={section.source} fetchedAt={section.fetchedAt}>
      {section.data.length === 0 ? (
        <p className="text-sm text-ink-faint">No coins matched your selected assets.</p>
      ) : (
        // Bounded for the same reason NewsCard's list is: with the asset cap now
        // equal to the full curated list, "select all" can serve as many rows as
        // the news feed does, and an unbounded card just as easily defeats the
        // column balancer.
        <ul className="scroll-slim -mr-2 max-h-[28rem] divide-y divide-line overflow-y-auto overscroll-contain pr-2">
          {section.data.map((coin) => (
            <li
              key={coin.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              {/* Decorative: the coin's name sits immediately beside it, so an
                  alt text here would make a screen reader announce it twice. */}
              <img
                src={coin.image}
                alt=""
                loading="lazy"
                className="size-8 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{coin.name}</p>
                <p className="font-mono text-xs uppercase text-ink-faint">{coin.symbol}</p>
              </div>
              {/* One instance that moves rather than two that hide: a display:none
                  copy would still mount and render a chart for every coin. Below sm
                  the row has no width left for it, so it wraps to a line of its own
                  instead of being withheld from phones entirely. */}
              <div className="order-last w-full sm:order-none sm:w-16 sm:shrink-0">
                <Sparkline
                  points={coin.sparkline}
                  priceChangePercentage24h={coin.priceChangePercentage24h}
                />
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-medium tabular-nums text-ink">
                  {formatPrice(coin.currentPrice)}
                </p>
                {coin.priceChangePercentage24h === null ? null : (
                  <p
                    className={
                      coin.priceChangePercentage24h >= 0
                        ? 'font-mono text-xs tabular-nums text-up'
                        : 'font-mono text-xs tabular-nums text-down'
                    }
                  >
                    {formatPercentChange(coin.priceChangePercentage24h)}
                  </p>
                )}
              </div>
              <VoteButtons
                section="prices"
                itemId={coin.id}
                preferenceVersion={preferenceVersion}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
