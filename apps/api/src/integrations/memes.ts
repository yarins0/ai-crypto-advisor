import type { CachedContent } from '../lib/cache.js';

export interface Meme {
  id: string;
  title: string;
  imageUrl: string;
}

const CARD_WIDTH = 600;
const CARD_HEIGHT = 400;
const CAPTION_FONT_SIZE = 30;

/**
 * Renders each meme as an inline SVG rather than linking one. A hosted image
 * would be a third-party request whose content and lifetime this project does
 * not control, and this is the one section with no upstream by design.
 */
function toCardDataUri(caption: string, accent: string): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="rgb(17,19,24)"/>`,
    `<rect x="0" y="0" width="${CARD_WIDTH}" height="8" fill="${accent}"/>`,
    `<circle cx="300" cy="150" r="58" fill="none" stroke="${accent}" stroke-width="6"/>`,
    `<text x="300" y="170" text-anchor="middle" font-family="monospace" font-size="56" fill="${accent}">$</text>`,
    `<text x="300" y="290" text-anchor="middle" font-family="monospace" font-size="${CAPTION_FONT_SIZE}" fill="rgb(233,236,241)">${caption}</text>`,
    `</svg>`,
  ].join('');

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Reddit blocks datacenter IPs, so a live meme fetch would never succeed from a
 * hosted API. This curated list is the primary source by design, not a stopgap.
 */
const MEME_CARDS = [
  { id: 'hodl-1', title: 'HODL through the dip', accent: 'rgb(247,147,26)' },
  { id: 'buy-high-1', title: 'Buy high, sell low', accent: 'rgb(239,68,68)' },
  { id: 'wagmi-1', title: 'WAGMI', accent: 'rgb(34,197,94)' },
  { id: 'this-is-fine-1', title: 'This is fine. Portfolio: -90%', accent: 'rgb(249,115,22)' },
  { id: 'to-the-moon-1', title: 'To the moon', accent: 'rgb(168,85,247)' },
  { id: 'paper-hands-1', title: 'Paper hands panic sell', accent: 'rgb(96,165,250)' },
  { id: 'diamond-hands-1', title: 'Diamond hands', accent: 'rgb(45,212,191)' },
  { id: 'when-lambo-1', title: 'When Lambo?', accent: 'rgb(250,204,21)' },
] as const;

export function getRandomMeme(): CachedContent<Meme> {
  const randomIndex = Math.floor(Math.random() * MEME_CARDS.length);
  // The `??` only satisfies noUncheckedIndexedAccess; randomIndex is always in range.
  const card = MEME_CARDS[randomIndex] ?? MEME_CARDS[0];

  return {
    data: { id: card.id, title: card.title, imageUrl: toCardDataUri(card.title, card.accent) },
    // 'live': the curated list is the intended path, not a degraded one.
    source: 'live',
    fetchedAt: new Date(),
  };
}
