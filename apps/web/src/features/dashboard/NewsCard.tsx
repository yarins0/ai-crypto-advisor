import type { NewsSection } from '@aca/shared';

import { Card } from '../../components/Card.js';
import { formatRelativeTime } from '../../lib/format.js';
import { VoteButtons } from '../votes/VoteButtons.js';

interface NewsCardProps {
  section: NewsSection;
  preferenceVersion: number;
}

export function NewsCard({ section, preferenceVersion }: NewsCardProps) {
  return (
    <Card title="News" source={section.source} fetchedAt={section.fetchedAt}>
      <ul className="flex flex-col gap-4">
        {section.data.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <a
                href={item.url}
                target="_blank"
                // noopener denies the opened page access to window.opener.
                rel="noopener noreferrer"
                className="line-clamp-2 text-sm text-slate-100 underline-offset-2 hover:underline"
              >
                {item.title}
              </a>
              <p className="mt-1 text-xs text-slate-500">{formatRelativeTime(item.publishedAt)}</p>
            </div>
            <VoteButtons section="news" itemId={item.id} preferenceVersion={preferenceVersion} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
