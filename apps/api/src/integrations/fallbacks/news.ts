import type { NewsItem } from '../cointelegraph.js';

/**
 * A real snapshot of Cointelegraph's general feed, captured 2026-08-26. Real
 * articles rather than invented ones because these links are clickable: a
 * plausible-looking but fabricated URL 404s the moment a reader follows it.
 * Taken from the general feed, so it reads sensibly for any asset's section.
 */
export const newsFallback = [
  {
    id: 'https://cointelegraph.com/news/77-of-americans-see-crypto-in-retirement-plans-as-risky-survey',
    title: '77% of Americans see crypto in retirement plans as risky: Survey',
    url: 'https://cointelegraph.com/news/77-of-americans-see-crypto-in-retirement-plans-as-risky-survey',
    publishedAt: '2026-08-26T16:10:56.000Z',
    imageUrl:
      'https://s3-images.ctmedia.io/media/article-covers/hi-how-trumps-9t-executive-order-could-let-you-add-bitcoin-to-your-retirement-plan.png',
  },
  {
    id: 'https://cointelegraph.com/markets/bitcoin-dips-below-78k-as-stocks-gold-fall-on-higher-us-pce-data',
    title: 'Bitcoin dips below $78K as stocks, gold fall on higher US PCE Inflation data',
    url: 'https://cointelegraph.com/markets/bitcoin-dips-below-78k-as-stocks-gold-fall-on-higher-us-pce-data',
    publishedAt: '2026-08-26T15:58:55.000Z',
    imageUrl: 'https://s3-images.ctmedia.io/media/article-covers/us-inflation-3.jpg',
  },
  {
    id: 'https://cointelegraph.com/ecosystem/protocol-upgrade-decouples-consensus-from-execution-to-solve-scaling-bottlenecks',
    title: 'Protocol upgrade decouples consensus from execution to solve scaling bottlenecks',
    url: 'https://cointelegraph.com/ecosystem/protocol-upgrade-decouples-consensus-from-execution-to-solve-scaling-bottlenecks',
    publishedAt: '2026-08-26T15:04:32.000Z',
    imageUrl: 'https://s3-images.ctmedia.io/media/article-covers/cover-multiversx-v1-1.jpg',
  },
  {
    id: 'https://cointelegraph.com/magazine/the-sec-wants-to-bring-back-icos-theres-a-catch',
    title: 'SEC’s proposed crypto rules probably won’t spark new ICO boom',
    url: 'https://cointelegraph.com/magazine/the-sec-wants-to-bring-back-icos-theres-a-catch',
    publishedAt: '2026-08-26T13:30:00.000Z',
    imageUrl: 'https://s3-images.ctmedia.io/media/article-covers/magazine-lambo-guy.jpg',
  },
  {
    id: 'https://cointelegraph.com/news/students-crypto-classes-learn-social-media-okx',
    title: 'Students want crypto classes but learn on social media: OKX survey',
    url: 'https://cointelegraph.com/news/students-crypto-classes-learn-social-media-okx',
    publishedAt: '2026-08-26T13:00:00.000Z',
    imageUrl:
      'https://s3-images.ctmedia.io/media/article-covers/hi-education-key-in-driving-crypto-adoption-in-africa2.jpg',
  },
  {
    id: 'https://cointelegraph.com/markets/bernstein-predicts-bitcoin-reclaim-125000-year-end',
    title: 'Bernstein forecasts Bitcoin to reclaim $125K by late 2026 ahead of cycle peak',
    url: 'https://cointelegraph.com/markets/bernstein-predicts-bitcoin-reclaim-125000-year-end',
    publishedAt: '2026-08-26T12:32:36.000Z',
    imageUrl:
      'https://s3-images.ctmedia.io/media/article-covers/hi-blockchain-powered-prediction-markets-governance-and-uses-beyond-death-pools-bitcoin-2.jpg',
  },
] as const satisfies readonly NewsItem[];
