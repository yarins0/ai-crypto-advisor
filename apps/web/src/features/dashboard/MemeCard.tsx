import type { MemeSection } from '@aca/shared';

import { Card } from '../../components/Card.js';
import { VoteButtons } from '../votes/VoteButtons.js';
import { useRerollMeme } from './use-dashboard.js';

interface MemeCardProps {
  section: MemeSection;
  preferenceVersion: number;
}

export function MemeCard({ section, preferenceVersion }: MemeCardProps) {
  const rerollMutation = useRerollMeme();
  const meme = section.data;

  return (
    <Card
      title="Meme"
      source={section.source}
      fetchedAt={section.fetchedAt}
      action={
        <button
          type="button"
          disabled={rerollMutation.isPending}
          onClick={() => {
            rerollMutation.mutate(meme.id);
          }}
          className="min-h-11 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 disabled:opacity-60"
        >
          Shuffle
        </button>
      }
    >
      <img
        src={meme.imageUrl}
        alt={meme.title}
        loading="lazy"
        className="w-full rounded-lg bg-slate-900"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm text-slate-300">{meme.title}</p>
        <VoteButtons section="memes" itemId={meme.id} preferenceVersion={preferenceVersion} />
      </div>
    </Card>
  );
}
