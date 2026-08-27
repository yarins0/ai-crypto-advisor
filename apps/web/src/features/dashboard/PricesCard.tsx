import type { PricesSection } from '@aca/shared';

import { Card } from '../../components/Card.js';
import { formatPercentChange, formatPrice } from '../../lib/format.js';
import { VoteButtons } from '../votes/VoteButtons.js';

interface PricesCardProps {
  section: PricesSection;
  preferenceVersion: number;
}

export function PricesCard({ section, preferenceVersion }: PricesCardProps) {
  return (
    <Card title="Prices" source={section.source} fetchedAt={section.fetchedAt}>
      <ul className="flex flex-col gap-3">
        {section.data.map((coin) => (
          <li key={coin.id} className="flex items-center gap-3">
            {/* Decorative: the coin's name sits immediately beside it, so an
                alt text here would make a screen reader announce it twice. */}
            <img src={coin.image} alt="" loading="lazy" className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{coin.name}</p>
              <p className="text-xs uppercase text-slate-500">{coin.symbol}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium text-slate-100">{formatPrice(coin.currentPrice)}</p>
              {coin.priceChangePercentage24h === null ? null : (
                <p
                  className={
                    coin.priceChangePercentage24h >= 0 ? 'text-xs text-up' : 'text-xs text-down'
                  }
                >
                  {formatPercentChange(coin.priceChangePercentage24h)}
                </p>
              )}
            </div>
            <VoteButtons section="prices" itemId={coin.id} preferenceVersion={preferenceVersion} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
