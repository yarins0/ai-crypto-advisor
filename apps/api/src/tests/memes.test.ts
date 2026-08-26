import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRandomMeme } from '../integrations/memes.js';

afterEach(() => {
  // fileParallelism is disabled, so every test file shares one worker; a
  // leaked stub here would poison tests in files run after this one.
  vi.restoreAllMocks();
});

describe('getRandomMeme', () => {
  it('returns a live meme with a fetchedAt Date and never calls fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = getRandomMeme();

    expect(result.source).toBe('live');
    expect(result.fetchedAt).toBeInstanceOf(Date);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('encodes the meme as a self-contained SVG data URI', () => {
    const result = getRandomMeme();

    expect(result.data.imageUrl.startsWith('data:image/svg+xml,')).toBe(true);
    const decodedSvg = decodeURIComponent(result.data.imageUrl.slice('data:image/svg+xml,'.length));
    expect(decodedSvg).toContain('<svg');
    expect(decodedSvg).toContain(result.data.title);
  });

  it('picks the first card when Math.random returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = getRandomMeme();

    expect(result.data.id).toBe('hodl-1');
  });

  it('picks the last card when Math.random returns just under 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const result = getRandomMeme();

    expect(result.data.id).toBe('when-lambo-1');
  });
});
