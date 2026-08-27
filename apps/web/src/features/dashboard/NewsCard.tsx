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
      {section.data.length === 0 ? (
        <p className="text-sm text-ink-faint">No headlines for your topics right now.</p>
      ) : (
        <ul className="divide-y divide-line">
          {section.data.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <a
                  href={item.url}
                  target="_blank"
                  // noopener denies the opened page access to window.opener.
                  rel="noopener noreferrer"
                  className="line-clamp-2 text-sm text-ink underline-offset-2 hover:underline"
                >
                  {item.title}
                </a>
                <p className="mt-1 font-mono text-xs text-ink-faint">
                  {formatRelativeTime(item.publishedAt)}
                </p>
              </div>
              <VoteButtons section="news" itemId={item.id} preferenceVersion={preferenceVersion} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
